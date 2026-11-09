import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  getTabId: vi.fn<() => string | null>(),
}));

vi.mock("@/lib/api/authenticated-fetch", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}));
vi.mock("@/lib/auth-session-client", () => ({
  expireClientSessionAndRedirect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ fetchSessionUserRaw: vi.fn() }));
vi.mock("@/lib/query-client", () => ({ getQueryClient: () => null }));
vi.mock("@/lib/tab-id", () => ({ getTabId: mocks.getTabId }));

import { apiFetch } from "./client";
import { jsonBody } from "./http";

const TAB_ID = "3f2b8c1e-7d4a-4e9b-9c2f-1a2b3c4d5e6f";
const REQUEST_URL = "http://localhost:8080/rooms/room-1/schedules/10/items";

/** apiFetch가 실제로 보낸 요청의 탭 ID 헤더 */
function sentTabId(): string | null {
  const init: RequestInit | undefined = mocks.authenticatedFetch.mock.calls[0]?.[1];
  return new Headers(init?.headers).get("X-Client-Tab-Id");
}

describe("apiFetch tab ID header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedFetch.mockResolvedValue({
      response: new Response(null, { status: 204 }),
      didRefresh: false,
    });
    mocks.getTabId.mockReturnValue(TAB_ID);
  });

  it.each([
    ["JSON POST", { method: "POST", ...jsonBody({ placeId: "p" }) }],
    ["PATCH", { method: "PATCH", ...jsonBody({ memo: "m" }) }],
    ["PUT", { method: "PUT", ...jsonBody({ content: "c" }) }],
    ["DELETE", { method: "DELETE" }],
  ] satisfies [string, RequestInit][])("adds the header to a %s that is already preflighted", async (_, init) => {
    await apiFetch(REQUEST_URL, init);

    expect(sentTabId()).toBe(TAB_ID);
  });

  it.each([
    ["GET without init", undefined],
    ["GET", { method: "GET" }],
    ["POST without body", { method: "POST" }],
  ] satisfies [string, RequestInit | undefined][])("leaves a %s without the header", async (_, init) => {
    await apiFetch(REQUEST_URL, init);

    expect(sentTabId()).toBeNull();
  });

  it("does not add the header when the tab has no ID", async () => {
    mocks.getTabId.mockReturnValue(null);

    await apiFetch(REQUEST_URL, { method: "DELETE" });

    expect(sentTabId()).toBeNull();
  });

  it.each([
    ["object", { "Content-Type": "application/json", "X-Extra": "1" }],
    ["Headers", new Headers({ "Content-Type": "application/json", "X-Extra": "1" })],
    ["array", [["Content-Type", "application/json"], ["X-Extra", "1"]]],
  ] satisfies [string, HeadersInit][])("keeps existing %s headers", async (_, headers) => {
    await apiFetch(REQUEST_URL, { method: "POST", headers, body: "{}" });

    const init: RequestInit | undefined = mocks.authenticatedFetch.mock.calls[0]?.[1];
    const sent = new Headers(init?.headers);
    expect(sent.get("Content-Type")).toBe("application/json");
    expect(sent.get("X-Extra")).toBe("1");
    expect(sent.get("X-Client-Tab-Id")).toBe(TAB_ID);
  });
});
