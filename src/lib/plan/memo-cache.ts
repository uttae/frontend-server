import { replaceEqualDeep, type QueryClient } from "@tanstack/react-query";
import { mergeMemo } from "./memo-version";

type Item = { itemId?: number; memo?: string | null; memoVersion?: number };
type Schedule = { scheduleId: number; items?: Item[] };
const lifetimes = new WeakMap<QueryClient, Map<string, number>>();

export function scheduleLifetime(qc: QueryClient, roomId: string): number {
  return lifetimes.get(qc)?.get(roomId.trim()) ?? 0;
}

/** Local request fence, never a substitute for the server memo version. */
export function advanceScheduleLifetime(qc: QueryClient, roomId: string): void {
  let rooms = lifetimes.get(qc);
  if (!rooms) { rooms = new Map(); lifetimes.set(qc, rooms); }
  const rid = roomId.trim();
  rooms.set(rid, (rooms.get(rid) ?? 0) + 1);
}

const targetLifetimes = new WeakMap<QueryClient, Map<string, number>>();
export function invalidateMemoTarget(qc: QueryClient, roomId: string, scheduleId?: number, itemId?: number): void {
  let targets = targetLifetimes.get(qc);
  if (!targets) { targets = new Map(); targetLifetimes.set(qc, targets); }
  const key = JSON.stringify([roomId.trim(), scheduleId, itemId]);
  targets.set(key, (targets.get(key) ?? 0) + 1);
}

/** Unrelated item moves/deletes must not reject an independent successful memo save. */
export function memoTargetLifetime(qc: QueryClient, roomId: string, scheduleId: number, itemId: number): string {
  const targets = targetLifetimes.get(qc);
  return [[roomId.trim()], [roomId.trim(), scheduleId], [roomId.trim(), scheduleId, itemId]]
    .map(([rid, sid, iid]) => targets?.get(JSON.stringify([rid, sid, iid])) ?? 0).join(":");
}

/** Install at query creation so REST, queryFn results and STOMP writes share one rule. */
export function installScheduleMemoCache(qc: QueryClient): void {
  qc.getQueryCache().subscribe((event) => {
    if (event.type !== "added" && !(event.type === "updated" && event.action.type === "fetch")) return;
    const query = event.query;
    const [kind, room] = query.queryKey;
    if ((kind !== "schedule-items" && kind !== "room-schedules") || typeof room !== "string") return;
    const structuralSharing = (oldData: unknown, newData: unknown) => {
      if (!Array.isArray(newData)) return replaceEqualDeep(oldData, newData);
      const known = new Map<number, Item>();
      const remember = (item: Item) => {
        if (typeof item.itemId === "number") known.set(item.itemId, mergeMemo(known.get(item.itemId), item));
      };
      for (const [, data] of qc.getQueriesData<Item[]>({ queryKey: ["schedule-items", room] })) {
        if (Array.isArray(data)) data.forEach(remember);
      }
      for (const [, data] of qc.getQueriesData<Schedule[]>({ queryKey: ["room-schedules", room] })) {
        if (Array.isArray(data)) data.forEach((s) => s.items?.forEach(remember));
      }
      const merge = (item: Item) => mergeMemo(known.get(item.itemId!), item);
      const next = kind === "schedule-items"
        ? newData.map(merge)
        : newData.map((s: Schedule) => Array.isArray(s.items) ? { ...s, items: s.items.map(merge) } : s);
      return replaceEqualDeep(oldData, next);
    };
    qc.setQueryDefaults(query.queryKey, { structuralSharing });
    query.setOptions({ ...query.options, structuralSharing });
  });
}
