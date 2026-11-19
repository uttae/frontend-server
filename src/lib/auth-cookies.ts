import type { NextResponse } from "next/server";

/** Fetch `Response`의 Set-Cookie 목록 (Node 18+ `getSetCookie`) */
export function getSetCookieHeaders(res: Response): string[] {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
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

/** BFF → 브라우저: 백엔드 Set-Cookie 전부 전달 */
export function forwardBackendSetCookies(
  res: NextResponse,
  backendRes: Response,
): void {
  appendSetCookies(res, getSetCookieHeaders(backendRes));
}
