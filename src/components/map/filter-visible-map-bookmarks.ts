import { normalizeGooglePlaceResourceId } from "@/lib/maps";

type MapBookmarkRow = {
  googlePlaceId: string;
};

export function filterVisibleMapBookmarks<T extends MapBookmarkRow>(
  rows: readonly T[],
  hiddenNormalizedPlaceIds?: ReadonlySet<string>,
): T[] {
  if (!hiddenNormalizedPlaceIds?.size) return [...rows];
  return rows.filter((row) => !hiddenNormalizedPlaceIds.has(normalizeGooglePlaceResourceId(row.googlePlaceId)));
}
