import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.hoisted(() => vi.fn((options) => options));
const requestPlacePhotoUrlMock = vi.hoisted(() => vi.fn());
const requestPlacePhotoUrlsBatchMock = vi.hoisted(() => vi.fn());

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: useQueryMock };
});

vi.mock("@/lib/api/places", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/places")>();
  return {
    ...actual,
    requestPlacePhotoUrl: requestPlacePhotoUrlMock,
    requestPlacePhotoUrlsBatch: requestPlacePhotoUrlsBatchMock,
  };
});

let createQueryClient: typeof import("@/lib/query-client").createQueryClient;
let HttpError: typeof import("@/lib/api/errors").HttpError;
let usePlacePhotoUrlQuery: typeof import("@/hooks/usePlacePhotoUrl").usePlacePhotoUrlQuery;

beforeAll(async () => {
  ({ createQueryClient } = await import("@/lib/query-client"));
  ({ HttpError } = await import("@/lib/api/errors"));
  ({ usePlacePhotoUrlQuery } = await import("@/hooks/usePlacePhotoUrl"));
});

beforeEach(() => {
  useQueryMock.mockClear();
  requestPlacePhotoUrlMock.mockReset();
  requestPlacePhotoUrlsBatchMock.mockReset();
});

function photoQueryOptions(googlePlaceId: string) {
  usePlacePhotoUrlQuery(googlePlaceId);
  const options = useQueryMock.mock.lastCall?.[0];
  if (!options) throw new Error("useQuery was not called");
  return options;
}

/** 같은 커밋에 카드 여러 장이 마운트된 것처럼 한 태스크 안에서 조회를 시작한다 */
function fetchCards(queryClient: ReturnType<typeof createQueryClient>, ids: string[]) {
  return Promise.allSettled(ids.map((id) => queryClient.fetchQuery(photoQueryOptions(id))));
}

const ok = (googlePlaceId: string) => ({
  status: "OK" as const,
  googlePlaceId,
  photoUrl: `https://cdn.example/${googlePlaceId}.jpg`,
});
const failed = (googlePlaceId: string) => ({
  status: "FAILED" as const,
  googlePlaceId,
  errorCode: "EXTERNAL_API_ERROR",
});

describe("usePlacePhotoUrlQuery", () => {
  it("사진 1장은 단건 API로 받고 같은 캐시를 다시 쓴다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlMock.mockResolvedValue("https://cdn.example/single.jpg");
    const options = photoQueryOptions(" ChIJ-single ");

    await expect(queryClient.fetchQuery(options)).resolves.toBe("https://cdn.example/single.jpg");
    await expect(queryClient.fetchQuery(options)).resolves.toBe("https://cdn.example/single.jpg");
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledExactlyOnceWith("ChIJ-single");
    expect(requestPlacePhotoUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("같은 커밋에 마운트된 카드 사진은 batch 하나로 받는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([
      ok("ChIJ-a"),
      { status: "OK", googlePlaceId: "ChIJ-b", photoUrl: null },
      ok("ChIJ-c"),
    ]);

    const results = await fetchCards(queryClient, ["ChIJ-a", "ChIJ-b", "ChIJ-c"]);

    expect(results).toEqual([
      { status: "fulfilled", value: "https://cdn.example/ChIJ-a.jpg" },
      { status: "fulfilled", value: "" },
      { status: "fulfilled", value: "https://cdn.example/ChIJ-c.jpg" },
    ]);
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledExactlyOnceWith(["ChIJ-a", "ChIJ-b", "ChIJ-c"]);
    expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();
  });

  it("batch 응답 id의 형식이 요청과 달라도 같은 장소로 맞춘다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([ok("ChIJ-a"), ok("places/ChIJ-b")]);

    const results = await fetchCards(queryClient, ["places/ChIJ-a", "ChIJ-b"]);

    expect(results).toEqual([
      { status: "fulfilled", value: "https://cdn.example/ChIJ-a.jpg" },
      { status: "fulfilled", value: "https://cdn.example/places/ChIJ-b.jpg" },
    ]);
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(1);
    expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();
  });

  it("batch 응답에 id가 빈 항목이 있어도 나머지 장은 받고, 빠진 장만 한 번 더 받는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([
      ok("ChIJ-a"),
      { status: "OK", googlePlaceId: null, photoUrl: "https://cdn.example/unknown.jpg" },
    ]);
    requestPlacePhotoUrlMock.mockResolvedValueOnce("https://cdn.example/ChIJ-b.jpg");

    const results = await fetchCards(queryClient, ["ChIJ-a", "ChIJ-b"]);

    expect(results).toEqual([
      { status: "fulfilled", value: "https://cdn.example/ChIJ-a.jpg" },
      { status: "fulfilled", value: "https://cdn.example/ChIJ-b.jpg" },
    ]);
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(1);
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledExactlyOnceWith("ChIJ-b");
  });

  it("batch 항목이 실패하면 실패한 장만 batch로 한 번 더 받고, 그래도 실패하면 끝낸다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock
      .mockResolvedValueOnce([ok("ChIJ-a"), failed("ChIJ-b"), failed("ChIJ-c")])
      .mockResolvedValueOnce([ok("ChIJ-b"), failed("ChIJ-c")]);

    const [a, b, c] = await fetchCards(queryClient, ["ChIJ-a", "ChIJ-b", "ChIJ-c"]);

    expect(a).toEqual({ status: "fulfilled", value: "https://cdn.example/ChIJ-a.jpg" });
    expect(b).toEqual({ status: "fulfilled", value: "https://cdn.example/ChIJ-b.jpg" });
    expect(c.status).toBe("rejected");
    expect(requestPlacePhotoUrlsBatchMock.mock.calls).toEqual([
      [["ChIJ-a", "ChIJ-b", "ChIJ-c"]],
      [["ChIJ-b", "ChIJ-c"]],
    ]);
    expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();
  });

  it("batch 429 → 총 1건: 다시 보내지 않는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock.mockRejectedValueOnce(new HttpError(429, "요청이 너무 많습니다"));

    const results = await fetchCards(queryClient, ["ChIJ-a", "ChIJ-b"]);

    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(1);
    expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();
  });

  it("항목 오류 + 단건 429 → 총 2건: 실패한 1장은 단건으로 한 번만 받는다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([ok("ChIJ-a"), failed("ChIJ-b")]);
    requestPlacePhotoUrlMock.mockRejectedValueOnce(new HttpError(429, "요청이 너무 많습니다"));

    const [a, b] = await fetchCards(queryClient, ["ChIJ-a", "ChIJ-b"]);

    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("rejected");
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(1);
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledExactlyOnceWith("ChIJ-b");
  });

  it.each([429, 404, 500, 502])("단건 GET이 %i면 다시 보내지 않는다", async (status) => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlMock.mockRejectedValueOnce(new HttpError(status, "Place photo failed"));

    await expect(queryClient.fetchQuery(photoQueryOptions("ChIJ-http-error"))).rejects.toThrow(
      "Place photo failed",
    );
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(1);
  });

  it("일시적 네트워크 오류만 한 번 더 보낸다", async () => {
    const queryClient = createQueryClient();
    requestPlacePhotoUrlMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("https://cdn.example/retried.jpg");

    await expect(
      queryClient.fetchQuery({ ...photoQueryOptions("ChIJ-network-error"), retryDelay: 0 }),
    ).resolves.toBe("https://cdn.example/retried.jpg");
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(2);
  });

  it("사진 없음('')은 5분 동안 다시 묻지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const now = new Date("2026-10-25T00:00:00.000Z").getTime();
      vi.setSystemTime(now);
      const queryClient = createQueryClient();
      requestPlacePhotoUrlMock
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce("https://cdn.example/available-later.jpg");
      const options = photoQueryOptions("ChIJ-no-photo");

      await expect(queryClient.fetchQuery(options)).resolves.toBe("");
      vi.setSystemTime(now + 4 * 60 * 1000);
      await expect(queryClient.fetchQuery(options)).resolves.toBe("");
      expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(1);

      vi.setSystemTime(now + 5 * 60 * 1000 + 1);
      await expect(queryClient.fetchQuery(options)).resolves.toBe(
        "https://cdn.example/available-later.jpg",
      );
      expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
