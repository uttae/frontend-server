import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch,
}));

vi.mock("@/lib/api/config", () => ({
  API_BASE: "https://api.example.test",
}));

describe("place photo API requests", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("requests a single photo URL with googlePlaceId instead of photoName", async () => {
    const { requestPlacePhotoUrl } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ photoUrl: "https://cdn.example/photo.jpg" }),
    });

    const photoUrl = await requestPlacePhotoUrl(" ChIJ-place-1 ");

    expect(photoUrl).toBe("https://cdn.example/photo.jpg");
    const requestedUrl = new URL(apiFetch.mock.calls[0]![0] as string);
    expect(requestedUrl.pathname).toBe("/places/photos");
    expect(requestedUrl.searchParams.get("googlePlaceId")).toBe("ChIJ-place-1");
    expect(requestedUrl.searchParams.has("photoName")).toBe(false);
  });

  it("requests a refreshed single photo URL when refresh is true", async () => {
    const { requestPlacePhotoUrl } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ photoUrl: "https://cdn.example/fresh.jpg" }),
    });

    await requestPlacePhotoUrl("ChIJ-place-1", { refresh: true });

    const requestedUrl = new URL(apiFetch.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.get("googlePlaceId")).toBe("ChIJ-place-1");
    expect(requestedUrl.searchParams.get("refresh")).toBe("true");
  });

  it("returns an empty photo URL for a disabled single photo response", async () => {
    const { requestPlacePhotoUrl } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      status: 204,
      ok: true,
      json: async () => {
        throw new Error("body should not be parsed");
      },
    });

    await expect(requestPlacePhotoUrl("ChIJ-place-1")).resolves.toBe("");
  });

  it("includes the API error detail when a single photo request fails", async () => {
    const { requestPlacePhotoUrl } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: "Google photo refresh failed" }),
    });

    await expect(requestPlacePhotoUrl("ChIJ-place-1")).rejects.toThrow(
      "Google photo refresh failed",
    );
  });

  it("throws an HttpError carrying the status when a single photo request fails", async () => {
    const { requestPlacePhotoUrl } = await import("@/lib/api/places");
    const { HttpError } = await import("@/lib/api/errors");
    apiFetch.mockResolvedValueOnce({
      status: 502,
      ok: false,
      json: async () => ({ code: "EXTERNAL_API_ERROR", message: "외부 API 호출 중 오류가 발생했습니다" }),
    });

    const error = await requestPlacePhotoUrl("ChIJ-place-1").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 502, message: "외부 API 호출 중 오류가 발생했습니다" });
  });

  it("throws an HttpError when the whole photo batch request is rate limited", async () => {
    const { requestPlacePhotoUrlsBatch } = await import("@/lib/api/places");
    const { HttpError } = await import("@/lib/api/errors");
    apiFetch.mockResolvedValueOnce({
      status: 429,
      ok: false,
      json: async () => ({ code: "RATE_LIMIT_EXCEEDED", message: "요청이 너무 많습니다" }),
    });

    const error = await requestPlacePhotoUrlsBatch(["ChIJ-place-1", "ChIJ-place-2"]).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 429 });
  });

  it("requests batch photo URLs with googlePlaceIds and reads googlePlaceId response items", async () => {
    const { requestPlacePhotoUrlsBatch } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        photos: [
          {
            status: "OK",
            googlePlaceId: "ChIJ-place-1",
            photoUrl: "https://cdn.example/one.jpg",
          },
        ],
      }),
    });

    const photos = await requestPlacePhotoUrlsBatch([
      " ChIJ-place-1 ",
      "ChIJ-place-1",
      "ChIJ-place-2",
    ]);

    const init = apiFetch.mock.calls[0]![1] as RequestInit & { body: string };
    expect(JSON.parse(init.body)).toEqual({
      googlePlaceIds: ["ChIJ-place-1", "ChIJ-place-2"],
    });
    expect(photos).toEqual([
      {
        status: "OK",
        googlePlaceId: "ChIJ-place-1",
        photoUrl: "https://cdn.example/one.jpg",
      },
    ]);
  });

  it("requests refreshed batch photo URLs when refresh is true", async () => {
    const { requestPlacePhotoUrlsBatch } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ photos: [] }),
    });

    await requestPlacePhotoUrlsBatch(["ChIJ-place-1"], { refresh: true });

    const init = apiFetch.mock.calls[0]![1] as RequestInit & { body: string };
    expect(JSON.parse(init.body)).toEqual({
      googlePlaceIds: ["ChIJ-place-1"],
      refresh: true,
    });
  });

  it("represents whole-batch 204 as explicit no-photo items instead of per-item failures", async () => {
    const { requestPlacePhotoUrlsBatch } = await import("@/lib/api/places");
    apiFetch.mockResolvedValueOnce({
      status: 204,
      ok: true,
      json: async () => {
        throw new Error("body should not be parsed");
      },
    });

    await expect(
      requestPlacePhotoUrlsBatch(["ChIJ-place-1", "ChIJ-place-2"]),
    ).resolves.toEqual([
      {
        status: "OK",
        googlePlaceId: "ChIJ-place-1",
        photoUrl: null,
      },
      {
        status: "OK",
        googlePlaceId: "ChIJ-place-2",
        photoUrl: null,
      },
    ]);
  });
});

describe("place preview API requests", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("throws an HttpError when the preview batch request is rate limited", async () => {
    const { requestPlacePreviewsBatch } = await import("@/lib/api/places");
    const { HttpError } = await import("@/lib/api/errors");
    apiFetch.mockResolvedValueOnce({
      status: 429,
      ok: false,
      json: async () => ({ code: "RATE_LIMIT_EXCEEDED", message: "요청이 너무 많습니다" }),
    });

    const error = await requestPlacePreviewsBatch(["ChIJ-place-1", "ChIJ-place-2"]).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 429, message: "요청이 너무 많습니다" });
  });

  it("throws an HttpError carrying the status when a single preview request fails", async () => {
    const { requestPlacePreview } = await import("@/lib/api/places");
    const { HttpError } = await import("@/lib/api/errors");
    apiFetch.mockResolvedValueOnce({ status: 502, ok: false, json: async () => ({}) });

    const error = await requestPlacePreview("ChIJ-place-1").catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 502 });
  });
});
