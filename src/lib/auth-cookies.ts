import type { NextResponse } from "next/server";

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

export function forwardBackendSetCookies(
  res: NextResponse,
  backendRes: Response,
): void {
  appendSetCookies(res, getSetCookieHeaders(backendRes));
}
