import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from "@/lib/maps";

const STORAGE_KEY = "hau:room-map-viewport:v1";

export type RoomMapViewport = {
  lat: number;
  lng: number;
  zoom: number;
};

type Payload = Record<string, RoomMapViewport>;

function loadAll(): Payload {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Payload;
  } catch {
    return {};
  }
}

function saveAll(payload: Payload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function roomKey(roomId: string): string {
  return roomId.trim();
}

function isValidViewport(v: unknown): v is RoomMapViewport {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const lat = o.lat;
  const lng = o.lng;
  const zoom = o.zoom;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof zoom !== "number"
  ) {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) {
    return false;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (zoom < MAP_MIN_ZOOM || zoom > MAP_MAX_ZOOM) return false;
  return true;
}

export function readRoomMapViewport(roomId: string): RoomMapViewport | null {
  const rid = roomKey(roomId);
  if (!rid.length) return null;
  const entry = loadAll()[rid];
  return isValidViewport(entry) ? entry : null;
}

export function writeRoomMapViewport(
  roomId: string,
  viewport: RoomMapViewport,
): void {
  const rid = roomKey(roomId);
  if (!rid.length || !isValidViewport(viewport)) return;
  const all = loadAll();
  all[rid] = {
    lat: viewport.lat,
    lng: viewport.lng,
    zoom: viewport.zoom,
  };
  saveAll(all);
}
