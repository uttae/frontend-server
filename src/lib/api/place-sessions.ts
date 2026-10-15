import { apiFetch } from "./client";
import { apiUrl, jsonBody, tryParseJson } from "./http";
import type { PlaceDetail } from "./places";

export type PlaceSession = { sessionToken: string; expiresAt: number };
export type PredictionText = {
  text: string | null;
  matches: { startOffset: number; endOffset: number }[] | null;
};
export type PlacePrediction = {
  placeId: string;
  text: PredictionText | null;
  structuredFormat: {
    mainText: PredictionText | null;
    secondaryText: PredictionText | null;
  } | null;
};
export type PlaceResolveResponse = {
  detail: PlaceDetail;
  source: "CACHE" | "GOOGLE" | "SESSION_REPLAY";
  cacheStatus: "HIT" | "MISS";
  googleDetailsRequested: boolean;
  termination: "NOT_TERMINATED" | "SUCCEEDED";
};
export class PlaceSessionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) { super(message); this.name = "PlaceSessionError"; }
}
const bucketWaits = { search: 0, read: 0 };
function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (retryAfter === null) return null;
  const milliseconds = /^\d+$/.test(retryAfter)
    ? Number(retryAfter) * 1000
    : Math.max(0, Date.parse(retryAfter) - Date.now());
  return Number.isFinite(milliseconds) ? milliseconds : null;
}
async function responseError(res: Response, bucket: keyof typeof bucketWaits): Promise<PlaceSessionError> {
  const raw = await tryParseJson(res);
  const error = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
  if (res.status === 429) bucketWaits[bucket] = Date.now() + (retryAfterMs ?? 60000);
  return new PlaceSessionError(
    res.status,
    typeof error.code === "string" ? error.code : "UNKNOWN",
    typeof error.message === "string" ? error.message : "장소 검색에 실패했어요. 다시 입력해주세요.",
    retryAfterMs,
  );
}
async function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const bucket = path === "/places/resolve" ? "read" : "search";
  if (bucketWaits[bucket] > Date.now())
    throw new PlaceSessionError(429, "RATE_LIMIT_EXCEEDED", "잠시 후 다시 검색해주세요.", bucketWaits[bucket] - Date.now());
  const res = await apiFetch(apiUrl(path), {
    method: "POST", ...(body === undefined ? {} : jsonBody(body)), signal,
  });
  if (!res.ok) throw await responseError(res, bucket);
  return res.json() as Promise<T>;
}
export function issuePlaceSession(signal?: AbortSignal) {
  return post<PlaceSession>("/places/sessions", undefined, signal);
}
export function autocompletePlaces(params: {
  sessionToken: string; input: string; latitude: number; longitude: number;
}, signal?: AbortSignal) {
  return post<{ suggestions: { placePrediction: PlacePrediction }[] }>("/places/autocomplete", params, signal);
}
export function resolvePlaceSession(sessionToken: string, googlePlaceId: string, signal?: AbortSignal) {
  return post<PlaceResolveResponse>("/places/resolve", { sessionToken, googlePlaceId }, signal);
}
