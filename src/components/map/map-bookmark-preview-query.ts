import { placePreviewQueryOptions } from "@/lib/places/place-queries";

import { filterVisibleMapBookmarks } from "./filter-visible-map-bookmarks";

type MapBookmarkRow = {
  googlePlaceId: string;
};

export function buildMapBookmarkPreviewPlan<T extends MapBookmarkRow>(
  rows: readonly T[],
  hiddenNormalizedPlaceIds: ReadonlySet<string> | undefined,
) {
  const visibleBookmarks = filterVisibleMapBookmarks(
    rows,
    hiddenNormalizedPlaceIds,
  );
  return {
    visibleBookmarks,
    queryOptions: visibleBookmarks.map((row) =>
      placePreviewQueryOptions(row.googlePlaceId),
    ),
  };
}
