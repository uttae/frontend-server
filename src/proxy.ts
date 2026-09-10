import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_SETTINGS_QUERY_KEY } from "@/lib/analytics/paths";
import { appendSetCookies } from "@/lib/auth-cookies";
import { verifySessionWithOptionalRefresh } from "@/lib/auth-server";
import { isProtectedAppPath } from "@/lib/auth-session";

const LINK_PREVIEW_BOT_UA =
  /facebookexternalhit|kakaotalk|twitterbot|slackbot|discordbot|linkedinbot|telegrambot|whatsapp|(?:^|[\s;(])line(?:\/|[\s;)])/i;

function isInvitePreviewRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/join/")) return false;
  const ua = request.headers.get("user-agent") ?? "";
  return LINK_PREVIEW_BOT_UA.test(ua);
}

function withRefreshedCookies(
  response: NextResponse,
  setCookies: readonly string[],
): NextResponse {
  if (setCookies.length > 0) {
    appendSetCookies(response, setCookies);
  }
  return response;
}

function withNoindexNofollow(response: NextResponse): NextResponse {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isInvitePreviewRequest(request)) {
    const response = NextResponse.rewrite(
      new URL("/invite-preview.html", request.url),
    );
    return withNoindexNofollow(response);
  }

  let hasSession = false;
  let setCookies: string[] = [];
  try {
    const verified = await verifySessionWithOptionalRefresh(
      request.headers.get("cookie"),
    );
    hasSession = verified.ok;
    setCookies = verified.setCookies;
  } catch {
    hasSession = false;
    setCookies = [];
  }

  if (pathname === "/login") {
    if (hasSession) {
      return withNoindexNofollow(
        withRefreshedCookies(
          NextResponse.redirect(new URL("/home", request.url)),
          setCookies,
        ),
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (request.nextUrl.searchParams.get(COOKIE_SETTINGS_QUERY_KEY) === "open") {
      return withRefreshedCookies(
        withNoindexNofollow(NextResponse.next()),
        setCookies,
      );
    }
    if (hasSession) {
      return withNoindexNofollow(
        withRefreshedCookies(
          NextResponse.redirect(new URL("/home", request.url)),
          setCookies,
        ),
      );
    }
    return NextResponse.next();
  }

  if (!isProtectedAppPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSession) {
    return withNoindexNofollow(
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  return withNoindexNofollow(
    withRefreshedCookies(NextResponse.next(), setCookies),
  );
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/join/:path*",
    "/auth/callback",
    "/home",
    "/home/:path*",
    "/plan",
    "/plan/:roomId",
    "/plan/:roomId/:path*",
    "/bookmark",
    "/bookmark/:path*",
    "/search",
    "/search/:path*",
    "/member-settings",
    "/member-settings/:path*",
    "/room-settings",
    "/room-settings/:path*",
    "/contact",
    "/settings",
    "/settings/:path*",
    "/waiting",
  ],
};
