import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.API_BASE_URL = "http://backend.test";
});

import {
  sessionCheckResponse,
  verifySessionWithOptionalRefresh,
} from "@/lib/auth-server";

const COOKIE = "access_token=old-access; refresh_token=old-refresh";
const REFRESHED_COOKIES = [
  "access_token=new-access; Path=/; HttpOnly",
  "refresh_token=new-refresh; Path=/; HttpOnly",
];

const fetchMock = vi.fn<typeof fetch>();

function status(code: number): Response {
  return new Response(null, { status: code });
}

function refreshed(): Response {
  const headers = new Headers();
  for (const cookie of REFRESHED_COOKIES) headers.append("set-cookie", cookie);
  return new Response(null, { status: 200, headers });
}

function sessionRequest(cookie: string): NextRequest {
  return new NextRequest("https://www.uttae.app/api/auth/session", {
    headers: { cookie },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifySessionWithOptionalRefresh", () => {
  it("treats a missing cookie as unauthenticated without calling the backend", async () => {
    await expect(verifySessionWithOptionalRefresh(null)).resolves.toEqual({
      ok: false,
      unavailable: false,
      setCookies: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks an unreachable backend as unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(verifySessionWithOptionalRefresh(COOKIE)).resolves.toEqual({
      ok: false,
      unavailable: true,
      setCookies: [],
    });
  });

  it.each([500, 502, 503, 429])(
    "marks users/me %i as unavailable without refreshing",
    async (code) => {
      fetchMock.mockResolvedValueOnce(status(code));

      const result = await verifySessionWithOptionalRefresh(COOKIE);

      expect(result).toMatchObject({ ok: false, unavailable: true });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );

  it("treats an expired access token without refresh_token as unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(status(401));

    await expect(
      verifySessionWithOptionalRefresh("access_token=old-access"),
    ).resolves.toEqual({ ok: false, unavailable: false, setCookies: [] });
  });

  it("treats a rejected refresh as unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(status(401)).mockResolvedValueOnce(status(401));

    await expect(verifySessionWithOptionalRefresh(COOKIE)).resolves.toEqual({
      ok: false,
      unavailable: false,
      setCookies: [],
    });
  });

  it("marks a failed refresh request as unavailable", async () => {
    fetchMock.mockResolvedValueOnce(status(401)).mockResolvedValueOnce(status(502));

    await expect(verifySessionWithOptionalRefresh(COOKIE)).resolves.toEqual({
      ok: false,
      unavailable: true,
      setCookies: [],
    });
  });

  it("returns refreshed cookies after a successful refresh", async () => {
    fetchMock
      .mockResolvedValueOnce(status(401))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(status(200));

    await expect(verifySessionWithOptionalRefresh(COOKIE)).resolves.toEqual({
      ok: true,
      unavailable: false,
      setCookies: REFRESHED_COOKIES,
    });
  });

  it("keeps refreshed cookies when the backend fails right after refreshing", async () => {
    fetchMock
      .mockResolvedValueOnce(status(401))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(status(503));

    await expect(verifySessionWithOptionalRefresh(COOKIE)).resolves.toEqual({
      ok: false,
      unavailable: true,
      setCookies: REFRESHED_COOKIES,
    });
  });
});

describe("sessionCheckResponse", () => {
  it("responds 200 for a valid session", async () => {
    fetchMock.mockResolvedValueOnce(status(200));

    const response = await sessionCheckResponse(sessionRequest(COOKIE));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("responds 503 when the backend is unavailable so clients retry instead of logging out", async () => {
    fetchMock.mockResolvedValueOnce(status(502));

    const response = await sessionCheckResponse(sessionRequest(COOKIE));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("forwards refreshed cookies with 503", async () => {
    fetchMock
      .mockResolvedValueOnce(status(401))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(status(503));

    const response = await sessionCheckResponse(sessionRequest(COOKIE));

    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toEqual(REFRESHED_COOKIES);
  });

  it("responds 401 only when authentication is confirmed to have failed", async () => {
    fetchMock.mockResolvedValueOnce(status(401)).mockResolvedValueOnce(status(401));

    const response = await sessionCheckResponse(sessionRequest(COOKIE));

    expect(response.status).toBe(401);
  });
});
