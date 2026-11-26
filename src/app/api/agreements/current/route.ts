import { NextResponse } from "next/server";

import { API_BASE } from "@/lib/api/config";

export async function GET() {
  const backendRes = await fetch(`${API_BASE}/api/agreements/current`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
