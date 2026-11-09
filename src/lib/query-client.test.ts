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

describe("invalidateAfterChange", () => {
  async function setup(initialData?: string[]) {
    const { QueryClient, QueryObserver } = await import("@tanstack/react-query");
    const { invalidateAfterChange } = await import("@/lib/query-client");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const responses: ((value: string[]) => void)[] = [];
    if (initialData) client.setQueryData(["members"], initialData);
    const observer = new QueryObserver(client, {
      queryKey: ["members"],
      queryFn: () => new Promise<string[]>((resolve) => responses.push(resolve)),
      staleTime: Infinity,
    });
    const stop = observer.subscribe(() => {});
    return { client, responses, stop, invalidateAfterChange };
  }

  it("데이터가 없는 첫 조회도 취소하고 새로 받아, 변경 전에 출발한 첫 응답을 쓰지 않는다", async () => {
    const { client, responses, stop, invalidateAfterChange } = await setup();
    try {
      // 마운트하자마자 첫 조회가 나갔다
      await vi.waitFor(() => expect(responses).toHaveLength(1));

      const done = invalidateAfterChange(client, { queryKey: ["members"] });
      await vi.waitFor(() => expect(responses).toHaveLength(2));
      responses[1]!(["나", "새 멤버"]);
      responses[0]!(["나"]);
      await done;

      expect(client.getQueryData(["members"])).toEqual(["나", "새 멤버"]);
    } finally {
      stop();
      client.clear();
    }
  });

  it("데이터가 있으면 받는 중인 조회를 무효화가 취소하고 새로 받는다", async () => {
    const { client, responses, stop, invalidateAfterChange } = await setup(["나"]);
    try {
      void client.refetchQueries({ queryKey: ["members"] });
      await vi.waitFor(() => expect(responses).toHaveLength(1));

      const done = invalidateAfterChange(client, { queryKey: ["members"] });
      expect(responses).toHaveLength(2);
      responses[1]!(["나", "새 멤버"]);
      responses[0]!(["나"]);
      await done;

      expect(client.getQueryData(["members"])).toEqual(["나", "새 멤버"]);
    } finally {
      stop();
      client.clear();
    }
  });

  it("받는 중인 조회가 없으면 기다리지 않고 바로 다시 받기 시작한다", async () => {
    const { client, responses, stop, invalidateAfterChange } = await setup(["나"]);
    try {
      void invalidateAfterChange(client, { queryKey: ["members"] });
      // 같은 틱에 이미 '받는 중'이라 이 사이의 렌더도 받는 중으로 본다
      expect(client.getQueryState(["members"])?.fetchStatus).toBe("fetching");
      expect(responses).toHaveLength(1);
    } finally {
      stop();
      client.clear();
    }
  });
});
