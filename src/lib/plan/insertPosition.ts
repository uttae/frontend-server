import type { PlanPlace } from "@/lib/plan/types";

/** 장소 사이 삽입 기준 — 메뉴를 연 시점의 앞 장소·뒤 장소와 위치 */
export type InsertAnchor = Readonly<{
  afterItemId: number;
  nextItemId: number | null;
  index: number;
}>;

/** 열린 시점의 목록에서 `afterItemId` 바로 뒤에 넣는 기준을 만든다 */
export function insertAnchorAfterItem(
  places: readonly PlanPlace[],
  afterItemId: number,
): InsertAnchor {
  const anchor = places.findIndex((p) => p.itemId === afterItemId);
  const index = anchor < 0 ? places.length : anchor + 1;
  const nextItemId = places[index]?.itemId;
  return { afterItemId, nextItemId: typeof nextItemId === "number" ? nextItemId : null, index };
}

/**
 * 최신 목록에서 삽입 위치를 정한다. null이면 맨 뒤.
 * 그사이 목록이 바뀌었으면 앞 장소 뒤 → 뒤 장소 앞 → 원래 위치(목록 길이로 제한) 순으로 찾는다.
 */
export function resolveInsertIndex(
  places: readonly PlanPlace[],
  anchor: InsertAnchor | null,
): number {
  if (anchor === null) return places.length;
  const after = places.findIndex((p) => p.itemId === anchor.afterItemId);
  if (after >= 0) return after + 1;
  if (anchor.nextItemId !== null) {
    const next = places.findIndex((p) => p.itemId === anchor.nextItemId);
    if (next >= 0) return next;
  }
  return Math.min(anchor.index, places.length);
}
