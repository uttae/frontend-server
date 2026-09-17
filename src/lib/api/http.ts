import { apiFetch } from "./client";
import { API_BASE } from "./config";
import { HttpError, readNormalizedApiErrorCode, readUserFacingMessageFromApiBody } from "./errors";

export type RequestJsonOptions = {
  errorMessage: string;
  /** If true, throws HttpError instead of Error */
  useHttpError?: boolean;
};

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  options: RequestJsonOptions,
): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const body = await tryParseJson(res);
    const detail = readUserFacingMessageFromApiBody(body);
    const msg = detail ?? `${options.errorMessage}: ${res.status}`;
    if (options.useHttpError) throw new HttpError(res.status, msg, readNormalizedApiErrorCode(body) ?? undefined);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function requestVoid(
  url: string,
  init: RequestInit | undefined,
  options: RequestJsonOptions,
): Promise<void> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const body = await tryParseJson(res);
    const detail = readUserFacingMessageFromApiBody(body);
    const msg = detail ?? `${options.errorMessage}: ${res.status}`;
    if (options.useHttpError) throw new HttpError(res.status, msg, readNormalizedApiErrorCode(body) ?? undefined);
    throw new Error(msg);
  }
}

export async function tryParseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function jsonBody(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
