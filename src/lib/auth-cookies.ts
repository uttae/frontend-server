import type { NextResponse } from "next/server";

/** Server-only configuration; intentionally not NEXT_PUBLIC build-time values. */
export function authCookieNames(): { access: string; refresh: string } {
  const access = process.env.AUTH_ACCESS_COOKIE_NAME;
  const refresh = process.env.AUTH_REFRESH_COOKIE_NAME;
  if (access === undefined && refresh === undefined) {
    return { access: "access_token", refresh: "refresh_token" };
  }
  const cookieName = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  if (!access || !refresh || access === refresh ||
      !cookieName.test(access) || !cookieName.test(refresh)) {
    throw new Error("Invalid auth cookie names: configure both distinct cookie names or neither");
  }
  return { access, refresh };
}

/** Only the selected environment's auth cookies may reach the backend. */
export function authCookieHeader(cookieHeader: string | null): string {
  const { access, refresh } = authCookieNames();
  return (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const eq = part.indexOf("=");
      return eq > 0 && [access, refresh].includes(part.slice(0, eq));
    })
    .join("; ");
}

/** Fetch `Response`의 Set-Cookie 목록 (Node 18+ `getSetCookie`) */
export function getSetCookieHeaders(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  // A combined header cannot safely be authorized by its first cookie name.
  // Expires dates contain commas, but not a new name=value after the comma.
  if (single && /,\s*[^;,\s]+=/.test(single)) return [];
  return single ? [single] : [];
}

export function appendSetCookies(
  res: NextResponse,
  cookies: readonly string[],
): void {
  for (const c of cookies) {
    res.headers.append("set-cookie", c);
  }
}

/** Preserve attributes verbatim, but never relay another environment's auth cookies. */
export function getAuthSetCookieHeaders(res: Response): string[] {
  const { access, refresh } = authCookieNames();
  return getSetCookieHeaders(res).filter((cookie) => {
    const eq = cookie.indexOf("=");
    return eq > 0 && [access, refresh].includes(cookie.slice(0, eq).trim());
  });
}

/** BFF → 브라우저: 선택한 인증 쿠키만 전달 */
export function forwardBackendSetCookies(
  res: NextResponse,
  backendRes: Response,
): void {
  appendSetCookies(res, getAuthSetCookieHeaders(backendRes));
}
