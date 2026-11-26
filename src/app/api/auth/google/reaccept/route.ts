import { NextRequest, NextResponse } from "next/server";

import { forwardBackendSetCookies } from "@/lib/auth-cookies";
import { API_BASE } from "@/lib/api/config";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    reacceptanceToken?: unknown;
    agreementsAccepted?: unknown;
  };

  const backendRes = await fetch(`${API_BASE}/auth/google/reaccept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reacceptanceToken: body.reacceptanceToken,
      agreementsAccepted: body.agreementsAccepted,
    }),
  });

  const res = new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });

  forwardBackendSetCookies(res, backendRes);

  return res;
}
