import { NextRequest, NextResponse } from "next/server";

import { authCookieHeader, forwardBackendSetCookies } from "@/lib/auth-cookies";
import { API_BASE } from "@/lib/api/config";

export async function POST(request: NextRequest) {
  const backendRes = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieHeader(request.headers.get("cookie")),
    },
  });

  const res = new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });

  forwardBackendSetCookies(res, backendRes);

  return res;
}
