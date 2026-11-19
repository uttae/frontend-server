export const UNTITLED_BOOKMARK_CATEGORY_LABEL = "제목 없는 북마크";

export function pickUniqueUntitledBookmarkCategoryName(
  existingNames: string[],
): string {
  const taken = new Set(
    existingNames.map((n) => n.trim()).filter((n) => n.length > 0),
  );
  const base = UNTITLED_BOOKMARK_CATEGORY_LABEL;
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}
