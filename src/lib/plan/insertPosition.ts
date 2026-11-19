import type { PlanPlace } from "@/lib/plan/types";

export type InsertAnchor = Readonly<{
  afterItemId: number;
  nextItemId: number | null;
  index: number;
}>;

export function insertAnchorAfterItem(places: readonly PlanPlace[], afterItemId: number): InsertAnchor {
  const anchor = places.findIndex((p) => p.itemId === afterItemId);
  const index = anchor < 0 ? places.length : anchor + 1;
  const nextItemId = places[index]?.itemId;
  return { afterItemId, nextItemId: typeof nextItemId === "number" ? nextItemId : null, index };
}

export function resolveInsertIndex(places: readonly PlanPlace[], anchor: InsertAnchor | null): number {
  if (anchor === null) return places.length;
  const after = places.findIndex((p) => p.itemId === anchor.afterItemId);
  if (after >= 0) return after + 1;
  if (anchor.nextItemId !== null) {
    const next = places.findIndex((p) => p.itemId === anchor.nextItemId);
    if (next >= 0) return next;
  }
  return Math.min(anchor.index, places.length);
}
