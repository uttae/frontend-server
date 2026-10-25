import { afterEach, describe, expect, it, vi } from "vitest";

describe("getOrCreateQueryClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reuses the browser QueryClient after the provider stack remounts", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});

    const queryClientModule = await import("@/lib/query-client");

    expect(queryClientModule.getOrCreateQueryClient).toBeTypeOf("function");

    const first = queryClientModule.getOrCreateQueryClient();
    const second = queryClientModule.getOrCreateQueryClient();

    expect(second).toBe(first);
    expect(queryClientModule.getQueryClient()).toBe(first);
  });
});

describe("shouldRetryQuery", () => {
  it("HTTP 오류(429·4xx·5xx)는 다시 보내지 않는다", async () => {
    const { shouldRetryQuery } = await import("@/lib/query-client");
    const { HttpError } = await import("@/lib/api/errors");

    for (const status of [400, 401, 404, 429, 500, 502, 503, 504]) {
      expect(shouldRetryQuery(0, new HttpError(status, "failed"))).toBe(false);
    }
    expect(shouldRetryQuery(0, new Error("일정 목록 조회 실패: 500"))).toBe(false);
  });

  it("일시적 네트워크 오류는 한 번만 다시 보낸다", async () => {
    const { shouldRetryQuery } = await import("@/lib/query-client");

    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError("Failed to fetch"))).toBe(false);
  });
});
