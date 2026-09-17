import type { QueryClient } from "@tanstack/react-query";
import { getScheduleItems, updateScheduleItem, type RoomScheduleItemUpdateRequest } from "@/lib/api/rooms/schedule-items";
import { HttpError } from "@/lib/api/errors";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { PlanPlace } from "./types";
import { isMemoVersion, mergeMemo } from "./memo-version";
import { memoTargetLifetime } from "./memo-cache";

export type ScheduleItemUpdate = { roomId: string; scheduleId: number; itemId: number; body: RoomScheduleItemUpdateRequest };
const pendingItems = new WeakMap<QueryClient, Set<string>>();
export const SCHEDULE_ITEM_UPDATE_KEY = ["schedule-item-update"] as const;

export function memoUnavailable(): HttpError {
  return new HttpError(404, "장소가 삭제되거나 이동했어요. 초안을 복사해 보관해 주세요.", "SCHEDULE_ITEM_NOT_FOUND");
}

export async function updateScheduleItemInCache(qc: QueryClient, args: ScheduleItemUpdate) {
  const { roomId, scheduleId, itemId, body } = args;
  const rid = roomId.trim();
  const key = scheduleItemsQueryKey(rid, scheduleId);
  const identity = `${rid}:${itemId}`;
  let pending = pendingItems.get(qc);
  if (!pending) { pending = new Set(); pendingItems.set(qc, pending); }
  if (pending.has(identity)) throw new Error("이 장소를 저장 중이에요.");
  const epoch = memoTargetLifetime(qc, rid, scheduleId, itemId);
  const memoTouched = Object.prototype.hasOwnProperty.call(body, "memo");
  const present = () => qc.getQueryData<PlanPlace[]>(key)?.some((p) => p.itemId === itemId);
  if (memoTouched && !present()) throw memoUnavailable();
  pending.add(identity);
  try {
    const updated = await updateScheduleItem(rid, scheduleId, itemId, body);
    if (epoch !== memoTargetLifetime(qc, rid, scheduleId, itemId) || updated.scheduleId !== scheduleId || updated.itemId !== itemId || !present()) throw memoUnavailable();
    qc.setQueryData<PlanPlace[]>(key, (prev) => prev?.map((p) => {
      if (p.itemId !== itemId) return p;
      // PATCH memo responses must not roll back concurrent structural/time writes.
      const next = { ...p, memo: typeof updated.memo === "string" ? updated.memo : undefined, memoVersion: updated.memoVersion };
      if (Object.prototype.hasOwnProperty.call(body, "startTime")) next.startTime = updated.startTime;
      if (Object.prototype.hasOwnProperty.call(body, "endTime")) next.endTime = updated.endTime;
      return mergeMemo(p, next);
    }));
    return updated;
  } finally { pending.delete(identity); }
}

/** A conflict refresh updates only existing items, never list membership or the draft. */
export async function refreshMemoConflict(qc: QueryClient, args: Omit<ScheduleItemUpdate, "body">): Promise<PlanPlace> {
  const { roomId, scheduleId, itemId } = args;
  const rid = roomId.trim();
  const epoch = memoTargetLifetime(qc, rid, scheduleId, itemId);
  const items = await getScheduleItems(rid, scheduleId);
  const latest = items.find((it) => it.itemId === itemId && it.scheduleId === scheduleId);
  const key = scheduleItemsQueryKey(rid, scheduleId);
  if (!latest || epoch !== memoTargetLifetime(qc, rid, scheduleId, itemId) || !qc.getQueryData<PlanPlace[]>(key)?.some((p) => p.itemId === itemId)) throw memoUnavailable();
  if (!isMemoVersion(latest.memoVersion)) throw new Error("최신 메모 버전을 확인할 수 없어요. 초안을 보관해 주세요.");
  qc.setQueryData<PlanPlace[]>(key, (prev) => prev?.map((p) => p.itemId === itemId
    ? mergeMemo(p, { ...p, memo: typeof latest.memo === "string" ? latest.memo : undefined, memoVersion: latest.memoVersion }) : p));
  return qc.getQueryData<PlanPlace[]>(key)!.find((p) => p.itemId === itemId)!;
}
