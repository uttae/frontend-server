import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/places/place-queries", () => ({
  placePreviewQueryOptions: (googlePlaceId: string) => ({
    queryKey: ["places", "preview", googlePlaceId],
    queryFn: async () => ({ googlePlaceId }),
    enabled: googlePlaceId.trim().length > 0,
  }),
}));

import { buildMapBookmarkPreviewPlan } from "./map-bookmark-preview-query";

describe("buildMapBookmarkPreviewPlan", () => {
  it("숨길 북마크를 빼고 남은 북마크의 미리보기 쿼리를 바로 연다", () => {
    const rows = [
      { bookmarkId: 1, googlePlaceId: "places/ChIJ-hidden" },
      { bookmarkId: 2, googlePlaceId: "ChIJ-visible" },
    ];

    const plan = buildMapBookmarkPreviewPlan(rows, new Set(["ChIJ-hidden"]));

    expect(plan.visibleBookmarks).toEqual([rows[1]]);
    expect(plan.queryOptions.map((options) => [options.queryKey, options.enabled])).toEqual([
      [["places", "preview", "ChIJ-visible"], true],
    ]);
  });
});
