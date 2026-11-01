import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("@/lib/api/client", () => ({
  apiFetch,
}));

vi.mock("@/lib/api/config", () => ({
  API_BASE: "https://api.example.test",
}));

describe("fetchPlacesPageWithPhotos", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("does not prefetch photo URLs for the full search result page", async () => {
    const { fetchPlacesPageWithPhotos } = await import("@/hooks/usePlacesSearch");
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            googlePlaceId: "ChIJ-place-1",
            name: "Place one",
            formattedAddress: "서울",
            location: { lat: 37.5, lng: 127.0 },
            primaryType: "restaurant",
            primaryTypeDisplayName: "음식점",
            rating: 4.5,
            userRatingCount: 10,
            openNow: true,
          },
        ],
        nextPageToken: null,
      }),
    });

    const page = await fetchPlacesPageWithPhotos({
      query: "맛집",
      latitude: 37.5,
      longitude: 127.0,
      radius: undefined,
      pageSize: 10,
      pageToken: undefined,
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(page.items[0]?.googlePlaceId).toBe("ChIJ-place-1");
    expect(page.items[0]).not.toHaveProperty("image");
  });
});
