import {
  resolvePlaceSession,
  PlaceSessionError,
  type PlacePrediction,
  type PlaceResolveResponse,
  type PlaceSession,
} from "@/lib/api/place-sessions";
import { getQueryClient } from "@/lib/query-client";
import { placeDetailQueryKey, normalizePreviewLocation } from "./place-queries";

export type SearchConfirmation = {
  query: string;
  kind: "whole" | "specific";
  prediction?: PlacePrediction;
  session: PlaceSession | null;
  generation: number;
};
export type ResolvedSearchAnchor = PlaceResolveResponse & {
  googlePlaceId: string;
  location: google.maps.LatLngLiteral;
};
const resolutions = new WeakMap<
  PlaceSession,
  {
    googlePlaceId: string;
    promise: Promise<PlaceResolveResponse>;
  }
>();
async function resolveWithInProgressRetry(
  session: PlaceSession,
  googlePlaceId: string,
  isCurrent: () => boolean,
): Promise<PlaceResolveResponse> {
  try {
    return await resolvePlaceSession(session.sessionToken, googlePlaceId);
  } catch (error) {
    if (!(error instanceof PlaceSessionError) || error.code !== "PLACE_SESSION_IN_PROGRESS") throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!isCurrent()) throw new DOMException("Search abandoned", "AbortError");
  }
  return resolvePlaceSession(session.sessionToken, googlePlaceId);
}
export function terminatePredictionSession(
  prediction: PlacePrediction,
  session: PlaceSession | null,
  isCurrent: () => boolean = () => true,
): Promise<PlaceResolveResponse> {
  if (!session || session.expiresAt <= Date.now())
    return Promise.reject(
      new PlaceSessionError(400, "PLACE_SESSION_INVALID", "검색 세션이 만료됐어요. 다시 입력해주세요."),
    );
  const existing = resolutions.get(session);
  if (existing)
    return existing.googlePlaceId === prediction.placeId
      ? existing.promise
      : Promise.reject(
          new PlaceSessionError(409, "PLACE_SESSION_CONFLICT", "이미 확인한 검색 세션입니다. 다시 검색해주세요."),
        );
  const promise = resolveWithInProgressRetry(session, prediction.placeId, isCurrent);
  resolutions.set(session, { googlePlaceId: prediction.placeId, promise });
  return promise;
}
type ConfirmPlaceSearchArgs<T> = Omit<SearchConfirmation, "generation"> & {
  mapCenter: google.maps.LatLngLiteral | null;
  radius: number;
  isCurrent: () => boolean;
  onAnchor?: (anchor: ResolvedSearchAnchor) => void;
  onResolved?: (resolved: PlaceResolveResponse) => void;
  search: (params: { query: string; latitude: number; longitude: number; radius: number }) => Promise<T[]>;
};
type SearchResolution = {
  anchor: ResolvedSearchAnchor | null;
  termination: PlaceResolveResponse["termination"] | "failed" | "not-requested";
};
async function resolveSearchPrediction<T>(
  args: ConfirmPlaceSearchArgs<T>,
  prediction: PlacePrediction,
): Promise<ResolvedSearchAnchor | null> {
  try {
    const resolved = await terminatePredictionSession(prediction, args.session, args.isCurrent);
    if (!args.isCurrent()) return null;
    getQueryClient()?.setQueryData(placeDetailQueryKey(resolved.detail.googlePlaceId), resolved.detail);
    args.onResolved?.(resolved);
    const location = normalizePreviewLocation(resolved.detail.location);
    if (!location || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180)
      throw new Error("장소 좌표를 확인할 수 없어요.");
    return { ...resolved, googlePlaceId: resolved.detail.googlePlaceId, location };
  } catch (error) {
    if (args.isCurrent()) throw error;
    return null;
  }
}
export async function confirmPlaceSearch<T>(
  args: ConfirmPlaceSearchArgs<T>,
): Promise<(SearchResolution & { items: T[] }) | null> {
  const query = args.query.trim();
  if (!query) throw new Error("검색어를 입력해주세요.");
  if (!args.isCurrent()) return null;
  if (args.kind === "specific") {
    if (!args.prediction) throw new Error("장소 정보를 확인할 수 없어요.");
    const anchor = await resolveSearchPrediction(args, args.prediction);
    if (!anchor || !args.isCurrent()) return null;
    args.onAnchor?.(anchor);
    return { anchor, items: [], termination: anchor.termination };
  }
  const center = args.mapCenter;
  if (!center) throw new Error("지도 위치를 확인한 뒤 다시 검색해주세요.");
  const items = await args.search({ query, latitude: center.lat, longitude: center.lng, radius: args.radius });
  if (!args.isCurrent()) return null;
  return { anchor: null, items, termination: "not-requested" };
}
