import { NextRequest, NextResponse } from "next/server";

import { forwardBackendSetCookies } from "@/lib/auth-cookies";
import { API_BASE } from "@/lib/api/config";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    code?: unknown;
    agreementsAccepted?: unknown;
  };

  const backendBody: { code?: unknown; agreementsAccepted?: true } = {
    code: body.code,
  };
  if (body.agreementsAccepted === true) {
    backendBody.agreementsAccepted = true;
  }

  const backendRes = await fetch(`${API_BASE}/auth/google/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(backendBody),
  });

  const res = new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });

  forwardBackendSetCookies(res, backendRes);

  return res;
}
