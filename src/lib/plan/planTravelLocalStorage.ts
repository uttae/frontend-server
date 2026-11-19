import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import type { PlanPlace } from "@/lib/plan/types";

function roundCoord(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toFixed(6);
}

const NS_ROUTE = "hau:plan:route:v1";

function routeStorageKey(
  roomId: string,
  scheduleId: number,
  segmentSourceItemId: number,
  destinationItemId: number,
  travelMode: string,
): string {
  return `${NS_ROUTE}:${roomId.trim()}:${scheduleId}:${segmentSourceItemId}:${destinationItemId}:${travelMode.trim()}`;
}

type PersistedRouteV1 = {
  fp: string;
  kind: "empty" | "data";
  body?: ScheduleItemRouteResponse;
};

function routeBodyOk(b: unknown): b is ScheduleItemRouteResponse {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.distanceMeters === "number" &&
    typeof o.durationSeconds === "number" &&
    typeof o.travelMode === "string"
  );
}

export function schedulePlacesFingerprint(places: PlanPlace[]): string {
  const parts: string[] = [];
  for (const p of places) {
    if (typeof p.itemId !== "number" || !Number.isFinite(p.itemId)) continue;
    const gid = (p.googlePlaceId ?? "").trim();
    const lat = p.location?.lat;
    const lng = p.location?.lng;
    const loc =
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
        ? `${roundCoord(lat)},${roundCoord(lng)}`
        : "";
    parts.push(`${p.itemId}:${gid}:${loc}`);
  }
  return parts.join("|");
}

function removeSessionStorageKeysMatchingPrefixes(prefixes: string[]): void {
  if (typeof window === "undefined" || prefixes.length === 0) return;
  const toRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (!k) continue;
    if (prefixes.some((p) => k.startsWith(p))) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) {
    try {
      sessionStorage.removeItem(k);
    } catch {}
  }
}

export function clearPersistedScheduleRoutesForSchedule(
  roomId: string,
  scheduleId: number,
): void {
  const rid = roomId.trim();
  if (!rid.length) return;
  removeSessionStorageKeysMatchingPrefixes([
    `${NS_ROUTE}:${rid}:${scheduleId}:`,
  ]);
}

export function readScheduleRouteFromSessionStorage(
  roomId: string,
  scheduleId: number,
  segmentSourceItemId: number,
  destinationItemId: number,
  travelMode: string,
  expectedFp: string,
): ScheduleItemRouteResponse | null | undefined {
  if (typeof window === "undefined" || !expectedFp) return undefined;
  try {
    const raw = sessionStorage.getItem(
      routeStorageKey(roomId, scheduleId, segmentSourceItemId, destinationItemId, travelMode),
    );
    if (!raw) return undefined;
    const o = JSON.parse(raw) as PersistedRouteV1;
    if (o.fp !== expectedFp) return undefined;
    if (o.kind === "empty") return null;
    if (o.kind === "data" && routeBodyOk(o.body)) return o.body;
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeScheduleRouteToSessionStorage(
  roomId: string,
  scheduleId: number,
  segmentSourceItemId: number,
  destinationItemId: number,
  travelMode: string,
  fp: string,
  data: ScheduleItemRouteResponse | null,
): void {
  if (typeof window === "undefined" || !fp) return;
  try {
    const key = routeStorageKey(
      roomId,
      scheduleId,
      segmentSourceItemId,
      destinationItemId,
      travelMode,
    );
    if (data === null) {
      sessionStorage.setItem(
        key,
        JSON.stringify({ fp, kind: "empty" } satisfies PersistedRouteV1),
      );
    } else {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          fp,
          kind: "data",
          body: data,
        } satisfies PersistedRouteV1),
      );
    }
  } catch {}
}


