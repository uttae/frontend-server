import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.API_BASE_URL = "http://backend.test"; });
import { sessionCheckResponse, verifySessionWithOptionalRefresh } from "./auth-server";
import { forwardBackendSetCookies } from "./auth-cookies";
import { POST as refresh } from "@/app/api/auth/refresh/route";
import { POST as login } from "@/app/api/auth/google/route";
import { POST as signup } from "@/app/api/auth/google/signup/route";
import { POST as reaccept } from "@/app/api/auth/google/reaccept/route";
import { POST as logout } from "@/app/api/auth/logout/route";

// All cookie values here are synthetic fixtures, never real credentials.
const prod = "access_token=prod-access; refresh_token=prod-refresh";
const qa = "qa_access_token=qa-access; qa_refresh_token=qa-refresh";
const rotated = [
  "qa_access_token=qa-new; Domain=.qa.uttae.app; Path=/; HttpOnly; Secure; SameSite=None",
  "qa_refresh_token=qa-new-refresh; Domain=.qa.uttae.app; Path=/; HttpOnly; Secure; SameSite=None",
];
const fetchMock = vi.fn<typeof fetch>();
function response(code: number, cookies: string[] = []) {
  const headers = new Headers();
  cookies.forEach(cookie => headers.append("set-cookie", cookie));
  return new Response(null, { status: code, headers });
}
function request(cookie: string) {
  return new NextRequest("https://qa.uttae.app/api/auth/session", { headers: { cookie } });
}
beforeEach(() => {
  vi.stubEnv("AUTH_ACCESS_COOKIE_NAME", "qa_access_token");
  vi.stubEnv("AUTH_REFRESH_COOKIE_NAME", "qa_refresh_token");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("QA auth cookie boundary", () => {
  it("rejects production-only cookies without contacting even an old backend", async () => {
    fetchMock.mockResolvedValue(response(200));
    const res = await sessionCheckResponse(request(prod));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ authenticated: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([`${prod}; ${qa}`, `${qa}; ${prod}`])("forwards only QA names in either header order: %s", async cookie => {
    fetchMock.mockResolvedValue(response(200));
    expect((await verifySessionWithOptionalRefresh(cookie)).ok).toBe(true);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ cookie: qa });
  });
  it("refreshes with QA-only refresh and retries using the rotated QA cookies", async () => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, rotated)).mockResolvedValueOnce(response(200));
    const res = await sessionCheckResponse(request("qa_refresh_token=qa-refresh"));
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual(rotated);
    expect(fetchMock.mock.calls[1][0]).toBe("http://backend.test/auth/refresh");
    expect(fetchMock.mock.calls[2][1]?.headers).toEqual({ cookie: "qa_refresh_token=qa-new-refresh; qa_access_token=qa-new" });
  });
  it("does not refresh QA access with a production refresh cookie", async () => {
    fetchMock.mockResolvedValue(response(401));
    expect((await verifySessionWithOptionalRefresh("qa_access_token=expired; refresh_token=prod-refresh")).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([refresh, logout])("filters request and deletion cookies at the BFF boundary", async handler => {
    const deletion = "qa_refresh_token=; Domain=.qa.uttae.app; Path=/; Max-Age=0; HttpOnly";
    fetchMock.mockResolvedValue(response(200, [deletion, "refresh_token=; Domain=.uttae.app; Path=/; Max-Age=0"]));
    const res = await handler(request(`${prod}; ${qa}`));
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ cookie: qa });
    expect(res.headers.getSetCookie()).toEqual([deletion]);
  });
  it("never relays old-backend production issuance or deletion through QA", () => {
    const res = NextResponse.json({});
    forwardBackendSetCookies(res, response(200, [...rotated, "access_token=old; Domain=.uttae.app; Path=/", "refresh_token=; Domain=.uttae.app; Max-Age=0"]));
    expect(res.headers.getSetCookie()).toEqual(rotated);
  });
  it("rejects ambiguous combined Set-Cookie when getSetCookie is unavailable", () => {
    const backend = response(200, [rotated[0], "refresh_token=; Domain=.uttae.app; Max-Age=0"]);
    Object.defineProperty(backend.headers, "getSetCookie", { value: undefined });
    const res = NextResponse.json({});
    forwardBackendSetCookies(res, backend);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
  it.each([503, "network"])("preserves QA rotation when retry is unavailable: %s", async failure => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, [...rotated, "access_token=prod-new; Domain=.uttae.app; Path=/"]));
    if (failure === "network") fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    else fetchMock.mockResolvedValueOnce(response(failure));
    const res = await sessionCheckResponse(request(`${prod}; ${qa}`));
    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toEqual(rotated);
  });
  it.each([login, signup, reaccept])("relays only QA issuance on login/signup/reaccept", async handler => {
    fetchMock.mockResolvedValue(response(200, [...rotated, "access_token=prod-access; Domain=.uttae.app; Path=/"]));
    const res = await handler(new NextRequest("https://qa.uttae.app/api/auth/google", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "synthetic-code", signupToken: "synthetic-signup", reacceptanceToken: "synthetic-reaccept", agreementsAccepted: true }),
    }));
    expect(res.headers.getSetCookie()).toEqual(rotated);
  });
  it.each([
    [undefined, "qa_refresh_token"], ["qa_access_token", undefined],
    ["", "qa_refresh_token"], ["same", "same"], ["bad;name", "refresh"],
  ])("fails closed for incomplete or invalid name configuration", async (access, refreshName) => {
    vi.stubEnv("AUTH_ACCESS_COOKIE_NAME", access);
    vi.stubEnv("AUTH_REFRESH_COOKIE_NAME", refreshName);
    await expect(verifySessionWithOptionalRefresh(prod)).rejects.toThrow("auth cookie names");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["production", "development"])("keeps default %s names and excludes QA cookies", async mode => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("AUTH_ACCESS_COOKIE_NAME", undefined);
    vi.stubEnv("AUTH_REFRESH_COOKIE_NAME", undefined);
    fetchMock.mockResolvedValue(response(200));
    expect((await verifySessionWithOptionalRefresh(`${qa}; ${prod}`)).ok).toBe(true);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ cookie: prod });
  });
});
