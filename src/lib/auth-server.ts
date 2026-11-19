import { NextRequest, NextResponse } from "next/server";

import { appendSetCookies, getSetCookieHeaders } from "@/lib/auth-cookies";
import { requiredEnv } from "@/lib/required-env";

const API_BASE = requiredEnv("API_BASE_URL");

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.length) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function mergeSetCookiesIntoCookieHeader(cookieHeader: string, setCookies: readonly string[]): string {
  const map = parseCookieHeader(cookieHeader);
  for (const sc of setCookies) {
    const first = sc.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    map.set(first.slice(0, eq), first.slice(eq + 1));
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function cookieHeaderHasRefreshToken(cookieHeader: string): boolean {
  return parseCookieHeader(cookieHeader).has("refresh_token");
}

type SessionVerifyResult = {
  ok: boolean;
  unavailable: boolean;
  setCookies: string[];
};

function unauthenticatedResult(): SessionVerifyResult {
  return { ok: false, unavailable: false, setCookies: [] };
}

function unavailableResult(setCookies: string[] = []): SessionVerifyResult {
  return { ok: false, unavailable: true, setCookies };
}

function isBackendUnavailable(res: Response): boolean {
  return res.status >= 500 || res.status === 429;
}

async function safeFetch(input: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    return null;
  }
}

async function fetchUsersMe(cookieHeader: string): Promise<Response | null> {
  return safeFetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
}

async function fetchBackendRefresh(cookieHeader: string): Promise<Response | null> {
  return safeFetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
    cache: "no-store",
  });
}

function warnSessionFetchFailed(label: string): void {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[auth-server] ${label} unreachable`);
  }
}

export async function verifySessionWithOptionalRefresh(cookieHeader: string | null): Promise<SessionVerifyResult> {
  const cookie = cookieHeader?.trim() ?? "";
  if (!cookie.length) {
    return unauthenticatedResult();
  }

  const meRes = await fetchUsersMe(cookie);
  if (meRes === null) {
    warnSessionFetchFailed("GET /users/me");
    return unavailableResult();
  }
  if (meRes.ok) {
    return { ok: true, unavailable: false, setCookies: [] };
  }
  if (isBackendUnavailable(meRes)) {
    return unavailableResult();
  }

  if (!cookieHeaderHasRefreshToken(cookie)) {
    return unauthenticatedResult();
  }

  const refreshRes = await fetchBackendRefresh(cookie);
  if (refreshRes === null) {
    warnSessionFetchFailed("POST /auth/refresh");
    return unavailableResult();
  }
  if (isBackendUnavailable(refreshRes)) {
    return unavailableResult();
  }
  if (!refreshRes.ok) {
    return unauthenticatedResult();
  }

  const setCookies = getSetCookieHeaders(refreshRes);
  const retryCookie = mergeSetCookiesIntoCookieHeader(cookie, setCookies);
  const retryMe = await fetchUsersMe(retryCookie);
  if (retryMe === null) {
    warnSessionFetchFailed("GET /users/me (after refresh)");
    return unavailableResult(setCookies);
  }
  if (retryMe.ok) {
    return { ok: true, unavailable: false, setCookies };
  }
  if (isBackendUnavailable(retryMe)) {
    return unavailableResult(setCookies);
  }
  return unauthenticatedResult();
}

export async function sessionCheckResponse(request: NextRequest): Promise<NextResponse> {
  const { ok, unavailable, setCookies } = await verifySessionWithOptionalRefresh(request.headers.get("cookie"));

  const baseHeaders = { "Cache-Control": "no-store" } as const;

  if (ok) {
    const res = NextResponse.json({ authenticated: true }, { status: 200, headers: baseHeaders });
    appendSetCookies(res, setCookies);
    return res;
  }

  if (unavailable) {
    const res = NextResponse.json({ authenticated: false }, { status: 503, headers: baseHeaders });
    appendSetCookies(res, setCookies);
    return res;
  }

  return NextResponse.json({ authenticated: false }, { status: 401, headers: baseHeaders });
}
