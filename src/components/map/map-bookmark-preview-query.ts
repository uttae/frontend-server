import { placePreviewQueryOptions } from "@/lib/places/place-queries";

import { filterVisibleMapBookmarks } from "./filter-visible-map-bookmarks";

type MapBookmarkRow = {
  googlePlaceId: string;
};

/** 핀으로 그릴 북마크와 그 미리보기 쿼리 — 같은 커밋에 마운트된 미리보기 요청은 batch 하나로 모인다 */
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
