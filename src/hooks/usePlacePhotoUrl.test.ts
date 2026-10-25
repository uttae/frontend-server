import { QueryClient, QueryObserver } from "@tanstack/react-query";
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

let fetchAndSeedPlacePhotoUrls: typeof import("@/lib/places/place-batch-cache").fetchAndSeedPlacePhotoUrls;
let ensurePlacePhotoUrlsCached: typeof import("@/lib/places/place-batch-cache").ensurePlacePhotoUrlsCached;
let placePhotoUrlQueryKey: typeof import("@/lib/place-photo-query").placePhotoUrlQueryKey;
let seededPlacePhotoUrlQueryOptions: typeof import("@/lib/place-photo-query").seededPlacePhotoUrlQueryOptions;
let registerQueryClient: typeof import("@/lib/query-client").registerQueryClient;
let createQueryClient: typeof import("@/lib/query-client").createQueryClient;
let HttpError: typeof import("@/lib/api/errors").HttpError;
let usePlacePhotoUrlQuery: typeof import("@/hooks/usePlacePhotoUrl").usePlacePhotoUrlQuery;

beforeAll(async () => {
  ({ fetchAndSeedPlacePhotoUrls, ensurePlacePhotoUrlsCached } = await import(
    "@/lib/places/place-batch-cache"
  ));
  ({ placePhotoUrlQueryKey, seededPlacePhotoUrlQueryOptions } = await import(
    "@/lib/place-photo-query"
  ));
  ({ registerQueryClient, createQueryClient } = await import("@/lib/query-client"));
  ({ HttpError } = await import("@/lib/api/errors"));
  ({ usePlacePhotoUrlQuery } = await import("@/hooks/usePlacePhotoUrl"));
});

beforeEach(() => {
  useQueryMock.mockClear();
  requestPlacePhotoUrlMock.mockReset();
  requestPlacePhotoUrlsBatchMock.mockReset();
});

describe("usePlacePhotoUrlQuery", () => {
  it("requests a cold single photo directly and reuses the shared cache", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    requestPlacePhotoUrlsBatchMock.mockResolvedValue([]);
    requestPlacePhotoUrlMock.mockResolvedValue("https://cdn.example/single.jpg");
    usePlacePhotoUrlQuery(" ChIJ-single ");
    const options = useQueryMock.mock.lastCall![0];
    await expect(queryClient.fetchQuery(options)).resolves.toBe("https://cdn.example/single.jpg");
    await expect(queryClient.fetchQuery(options)).resolves.toBe("https://cdn.example/single.jpg");
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledExactlyOnceWith("ChIJ-single");
    expect(requestPlacePhotoUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("reuses a batch-seeded photo without issuing a single request", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    requestPlacePhotoUrlsBatchMock.mockResolvedValue([{status:"OK",googlePlaceId:"ChIJ-seeded",photoUrl:"https://cdn.example/seeded.jpg"}]);
    await fetchAndSeedPlacePhotoUrls(["ChIJ-seeded"],queryClient);
    usePlacePhotoUrlQuery("ChIJ-seeded");
    await expect(queryClient.fetchQuery(useQueryMock.mock.lastCall![0])).resolves.toBe("https://cdn.example/seeded.jpg");
    expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();
    expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(1);
  });

  it("authoritative empty 항목만 캐시하고 per-item FAILED는 cache miss로 남긴다", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    const emptyId = "ChIJ-authoritative-empty";
    const failedId = "ChIJ-per-item-failed";
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([
      { status: "OK", googlePlaceId: emptyId },
      {
        status: "FAILED",
        googlePlaceId: failedId,
        errorCode: "UPSTREAM_TIMEOUT",
      },
    ]);

    await fetchAndSeedPlacePhotoUrls([emptyId, failedId], queryClient);

    expect(queryClient.getQueryData(placePhotoUrlQueryKey(emptyId))).toBe("");
    expect(
      queryClient.getQueryData(placePhotoUrlQueryKey(failedId)),
    ).toBeUndefined();
  });

  it("mixed batch의 FAILED 항목은 빈 URL로 고정하지 않고 단건 GET으로 fallback한다", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    const okId = "ChIJ-ok";
    const failedId = "ChIJ-failed";
    const failedItem = {
      status: "FAILED" as const,
      googlePlaceId: failedId,
      errorCode: "UPSTREAM_TIMEOUT",
    };
    requestPlacePhotoUrlsBatchMock
      .mockResolvedValueOnce([
        {
          status: "OK",
          googlePlaceId: okId,
          photoUrl: "https://cdn.example/ok.jpg",
        },
        failedItem,
      ])
      .mockResolvedValueOnce([failedItem]);
    requestPlacePhotoUrlMock.mockResolvedValueOnce(
      "https://cdn.example/fallback.jpg",
    );

    await fetchAndSeedPlacePhotoUrls([okId, failedId], queryClient);

    expect(queryClient.getQueryData(placePhotoUrlQueryKey(okId))).toBe(
      "https://cdn.example/ok.jpg",
    );
    expect(queryClient.getQueryData(placePhotoUrlQueryKey(failedId))).toBeUndefined();

    usePlacePhotoUrlQuery(failedId);
    const queryOptions = useQueryMock.mock.lastCall?.[0];
    const photoUrl = await queryClient.fetchQuery(queryOptions);

    expect(photoUrl).toBe("https://cdn.example/fallback.jpg");
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledWith(failedId);
    expect(queryClient.getQueryData(placePhotoUrlQueryKey(failedId))).toBe(
      "https://cdn.example/fallback.jpg",
    );
  });

  it.each([429, 404, 500, 502])("단건 GET이 %i면 다시 보내지 않는다", async (status) => {
    const queryClient = createQueryClient();
    registerQueryClient(queryClient);
    requestPlacePhotoUrlMock.mockRejectedValueOnce(new HttpError(status, "Place photo failed"));

    usePlacePhotoUrlQuery("ChIJ-http-error");
    const queryOptions = useQueryMock.mock.lastCall?.[0];

    await expect(queryClient.fetchQuery(queryOptions)).rejects.toThrow("Place photo failed");
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(1);
    expect(requestPlacePhotoUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("일시적 네트워크 오류만 한 번 더 보낸다", async () => {
    const queryClient = createQueryClient();
    registerQueryClient(queryClient);
    requestPlacePhotoUrlMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("https://cdn.example/retried.jpg");

    usePlacePhotoUrlQuery("ChIJ-network-error");
    const queryOptions = useQueryMock.mock.lastCall?.[0];

    await expect(queryClient.fetchQuery({ ...queryOptions, retryDelay: 0 })).resolves.toBe(
      "https://cdn.example/retried.jpg",
    );
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(2);
  });

  it("seeded multi-photo query도 FAILED 캐시 miss를 빈 URL 성공으로 바꾸지 않는다", async () => {
    const queryClient = new QueryClient();
    registerQueryClient(queryClient);
    const okId = "ChIJ-multi-ok";
    const failedId = "ChIJ-multi-failed";
    requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([
      {
        status: "OK",
        googlePlaceId: okId,
        photoUrl: "https://cdn.example/multi-ok.jpg",
      },
      {
        status: "FAILED",
        googlePlaceId: failedId,
        errorCode: "UPSTREAM_TIMEOUT",
      },
    ]);
    requestPlacePhotoUrlMock.mockResolvedValueOnce(
      "https://cdn.example/multi-fallback.jpg",
    );

    await fetchAndSeedPlacePhotoUrls([okId, failedId], queryClient);
    const options = seededPlacePhotoUrlQueryOptions(failedId);

    await expect(queryClient.fetchQuery(options)).resolves.toBe(
      "https://cdn.example/multi-fallback.jpg",
    );
    expect(requestPlacePhotoUrlMock).toHaveBeenCalledWith(failedId);
    expect(queryClient.getQueryData(placePhotoUrlQueryKey(failedId))).toBe(
      "https://cdn.example/multi-fallback.jpg",
    );
  });

  it("seeded multi-photo의 no-photo 캐시도 5분 후 단건 GET을 허용한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));

    try {
      const queryClient = new QueryClient();
      registerQueryClient(queryClient);
      const id = "ChIJ-seeded-no-photo";
      requestPlacePhotoUrlsBatchMock.mockResolvedValueOnce([
        { status: "OK", googlePlaceId: id, photoUrl: null },
      ]);
      await fetchAndSeedPlacePhotoUrls([id], queryClient);

      const options = seededPlacePhotoUrlQueryOptions(id);
      await expect(queryClient.fetchQuery(options)).resolves.toBe("");
      expect(requestPlacePhotoUrlMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      requestPlacePhotoUrlMock.mockResolvedValueOnce(
        "https://cdn.example/seeded-available-later.jpg",
      );

      const observer = new QueryObserver(queryClient, options);
      const unsubscribe = observer.subscribe(() => undefined);
      try {
        await vi.waitFor(() => {
          expect(requestPlacePhotoUrlMock).toHaveBeenCalledWith(id);
          expect(queryClient.getQueryData(options.queryKey)).toBe(
            "https://cdn.example/seeded-available-later.jpg",
          );
        });
      } finally {
        unsubscribe();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("single no-photo is cached for five minutes then retried with a single GET", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));
    try {
      const queryClient = new QueryClient();
      registerQueryClient(queryClient);
      const id = "ChIJ-no-photo";
      requestPlacePhotoUrlMock.mockResolvedValueOnce("").mockResolvedValueOnce("https://cdn.example/available-later.jpg");
      usePlacePhotoUrlQuery(id);
      const options = useQueryMock.mock.lastCall![0];
      await expect(queryClient.fetchQuery(options)).resolves.toBe("");
      vi.advanceTimersByTime(4 * 60 * 1000);
      await expect(queryClient.fetchQuery(options)).resolves.toBe("");
      expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60 * 1000 + 1);
      await expect(queryClient.fetchQuery(options)).resolves.toBe("https://cdn.example/available-later.jpg");
      expect(requestPlacePhotoUrlMock).toHaveBeenCalledTimes(2);
      expect(requestPlacePhotoUrlsBatchMock).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("만료된 no-photo 뒤 batch FAILED면 낡은 빈 값을 쓰지 않고 단건 fallback한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));

    try {
      const queryClient = new QueryClient();
      registerQueryClient(queryClient);
      const id = "ChIJ-expired-then-failed";
      requestPlacePhotoUrlsBatchMock
        .mockResolvedValueOnce([
          { status: "OK", googlePlaceId: id, photoUrl: null },
        ])
        .mockResolvedValueOnce([
          {
            status: "FAILED",
            googlePlaceId: id,
            errorCode: "UPSTREAM_TIMEOUT",
          },
        ]);
      requestPlacePhotoUrlMock.mockResolvedValueOnce(
        "https://cdn.example/single-fallback.jpg",
      );

      await fetchAndSeedPlacePhotoUrls([id], queryClient);
      usePlacePhotoUrlQuery(id);
      const queryOptions = useQueryMock.mock.lastCall?.[0];
      await expect(queryClient.fetchQuery(queryOptions)).resolves.toBe("");

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await fetchAndSeedPlacePhotoUrls([id], queryClient);

      await expect(queryClient.fetchQuery(queryOptions)).resolves.toBe(
        "https://cdn.example/single-fallback.jpg",
      );
      expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(2);
      expect(requestPlacePhotoUrlMock).toHaveBeenCalledWith(id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("중간 ensure 호출이 no-photo의 최초 5분 TTL을 연장하지 않는다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));

    try {
      const queryClient = new QueryClient();
      registerQueryClient(queryClient);
      const id = "ChIJ-no-photo-ensure";
      requestPlacePhotoUrlsBatchMock
        .mockResolvedValueOnce([
          { status: "OK", googlePlaceId: id, photoUrl: null },
        ])
        .mockResolvedValueOnce([
          {
            status: "OK",
            googlePlaceId: id,
            photoUrl: "https://cdn.example/available-after-ttl.jpg",
          },
        ]);

      await ensurePlacePhotoUrlsCached([id], queryClient);
      vi.advanceTimersByTime(4 * 60 * 1000);
      await ensurePlacePhotoUrlsCached([id], queryClient);
      vi.advanceTimersByTime(60 * 1000 + 1);
      await ensurePlacePhotoUrlsCached([id], queryClient);

      expect(requestPlacePhotoUrlsBatchMock).toHaveBeenCalledTimes(2);
      expect(queryClient.getQueryData(placePhotoUrlQueryKey(id))).toBe(
        "https://cdn.example/available-after-ttl.jpg",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
