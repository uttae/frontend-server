import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import type { PlanItinerarySegmentDescriptor } from "@/lib/plan/planItineraryMapSegments";

const STORAGE_KEY = "hau:destination-center-v1";

type Payload = Record<
  string,
  { lat: number; lng: number; destination: string }
>;

function loadAll(): Payload {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Payload;
  } catch {
    return {};
  }
}

function saveAll(payload: Payload): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function destinationCacheKey(roomId: string): string {
  return roomId.trim();
}

export function readDestinationLatLngFromSession(
  roomId: string,
  destination: string,
): google.maps.LatLngLiteral | null {
  const rid = destinationCacheKey(roomId);
  const d = destination.trim();
  if (!rid.length || !d.length) return null;
  const entry = loadAll()[rid];
  if (!entry || entry.destination !== d) return null;
  const { lat, lng } = entry;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function writeDestinationLatLngToSession(
  roomId: string,
  destination: string,
  coords: google.maps.LatLngLiteral,
): void {
  const rid = destinationCacheKey(roomId);
  const d = destination.trim();
  if (!rid.length || !d.length) return;
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
  const all = loadAll();
  all[rid] = { lat: coords.lat, lng: coords.lng, destination: d };
  saveAll(all);
}

export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 21;

type GoogleMapsDirectionsTravelMode =
  | "WALKING"
  | "TRANSIT"
  | "DRIVING";

const GOOGLE_MAPS_DIRECTIONS_TRAVEL_MODE = {
  WALKING: "walking",
  TRANSIT: "transit",
  DRIVING: "driving",
} as const satisfies Record<GoogleMapsDirectionsTravelMode, string>;

export function buildGoogleMapsPlaceUrl({
  placeId,
  query,
}: {
  placeId: string;
  query?: string;
}): string | null {
  const id = placeId.trim();
  if (!id.length) return null;
  const q = (query ?? "").trim() || id;
  const params = new URLSearchParams({
    api: "1",
    query: q,
    query_place_id: id,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsDirectionsUrl({
  originPlaceId,
  originQuery,
  destinationPlaceId,
  destinationQuery,
  travelMode,
}: {
  originPlaceId: string;
  originQuery: string;
  destinationPlaceId: string;
  destinationQuery: string;
  travelMode: GoogleMapsDirectionsTravelMode;
}): string | null {
  const originId = originPlaceId.trim();
  const destinationId = destinationPlaceId.trim();
  if (!originId.length || !destinationId.length) return null;

  const params = new URLSearchParams({
    api: "1",
    origin: originQuery.trim() || originId,
    origin_place_id: originId,
    destination: destinationQuery.trim() || destinationId,
    destination_place_id: destinationId,
    travelmode: GOOGLE_MAPS_DIRECTIONS_TRAVEL_MODE[travelMode],
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export const MAP_WORLD_LAT_LNG_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 85,
  south: -85,
  west: -179.999,
  east: 179.999,
};

export const MAP_PAN_RESTRICTION: google.maps.MapRestriction = {
  latLngBounds: MAP_WORLD_LAT_LNG_BOUNDS,
  strictBounds: true,
};

export function panToWithinWorld(
  map: google.maps.Map,
  target: google.maps.LatLngLiteral,
): void {
  const center = map.getCenter();
  if (center && Math.abs(target.lng - center.lng()) > 180) {
    map.setCenter(target);
    return;
  }
  map.panTo(target);
}

const PAN_ANIMATION_MAX_SCREENS = 1.5;
const PAN_ANIMATION_BASE_MS = 100;
const PAN_ANIMATION_MS_PER_SCREEN = 690;

const activeMoves = new WeakMap<google.maps.Map, { target: google.maps.LatLngLiteral; stop: () => void }>();

function isSameLatLng(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
}

export function moveMapTo(
  map: google.maps.Map,
  target: google.maps.LatLngLiteral,
  { zoom }: { zoom?: number } = {},
): () => void {
  const currentZoom = map.getZoom();
  const zoomChanges = zoom !== undefined && zoom !== currentZoom;
  const active = activeMoves.get(map);
  if (active && !zoomChanges && isSameLatLng(active.target, target)) return active.stop;
  active?.stop();

  const center = map.getCenter();
  const projection = map.getProjection();
  const from = center && projection ? projection.fromLatLngToPoint(center) : null;
  const to = projection ? projection.fromLatLngToPoint(target) : null;
  if (zoomChanges || currentZoom === undefined || !center || !projection || !from || !to || Math.abs(target.lng - center.lng()) > 180) {
    panToWithinWorld(map, target);
    if (zoomChanges) map.setZoom(zoom);
    return () => {};
  }
  const div = map.getDiv();
  const scale = 2 ** currentZoom;
  const screens = Math.hypot(
    ((to.x - from.x) * scale) / div.clientWidth,
    ((to.y - from.y) * scale) / div.clientHeight,
  );
  if (!(screens <= PAN_ANIMATION_MAX_SCREENS)) {
    map.setCenter(target);
    return () => {};
  }
  const duration = PAN_ANIMATION_BASE_MS + PAN_ANIMATION_MS_PER_SCREEN * screens;
  const start = performance.now();
  let frame = 0;
  let placed = from;
  const move = { target, stop: () => {} };
  const stop = () => {
    cancelAnimationFrame(frame);
    listeners.forEach((listener) => listener.remove());
    if (activeMoves.get(map) === move) activeMoves.delete(map);
  };
  move.stop = stop;
  const step = (now: number) => {
    const current = map.getCenter();
    const at = current ? projection.fromLatLngToPoint(current) : null;
    if (!at || Math.hypot(at.x - placed.x, at.y - placed.y) * scale > 2) {
      stop();
      return;
    }
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 1.5;
    placed = t < 1 ? new google.maps.Point(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased) : to;
    map.moveCamera({ center: t < 1 ? (projection.fromPointToLatLng(placed) ?? target) : target });
    if (t < 1) frame = requestAnimationFrame(step);
    else stop();
  };
  const listeners = [map.addListener("dragstart", stop), map.addListener("zoom_changed", stop)];
  activeMoves.set(map, move);
  frame = requestAnimationFrame(step);
  return stop;
}

export function normalizeGooglePlaceResourceId(id: string): string {
  const prefix = "places/";
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

export function googlePlacesJsLocalizedText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof (value as { text?: unknown }).text === "string"
  ) {
    return ((value as { text: string }).text ?? "").trim();
  }
  return "";
}

export function haversineMeters(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const x =
    sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

export function viewportSearchRadiusMetersFromBounds(
  center: google.maps.LatLngLiteral,
  bounds: google.maps.LatLngBoundsLiteral,
): number {
  const toNorth = haversineMeters(center, {
    lat: bounds.north,
    lng: center.lng,
  });
  const toSouth = haversineMeters(center, {
    lat: bounds.south,
    lng: center.lng,
  });
  const toEast = haversineMeters(center, {
    lat: center.lat,
    lng: bounds.east,
  });
  const toWest = haversineMeters(center, {
    lat: center.lat,
    lng: bounds.west,
  });
  return clampPlacesSearchRadiusMeters(
    Math.min(toNorth, toSouth, toEast, toWest),
  );
}

export function shouldSuggestPlacesSearchRecenter(params: {
  mapCenter: google.maps.LatLngLiteral;
  snapshotCenter: google.maps.LatLngLiteral;
  snapshotRadiusMeters: number;
  zoom: number | null;
  snapshotZoom: number | null;
}): boolean {
  const dist = haversineMeters(params.mapCenter, params.snapshotCenter);
  const threshold = Math.max(200, params.snapshotRadiusMeters * 0.1);
  const zoomDelta =
    params.zoom != null && params.snapshotZoom != null
      ? Math.abs(params.zoom - params.snapshotZoom)
      : 0;
  return dist > threshold || zoomDelta >= 1;
}

type PlanGeometryLibrary = {
  encoding: {
    decodePath(encodedPath: string): Array<{ lat(): number; lng(): number }>;
  };
};

export function orientPathSmallerStopToLarger(
  pts: google.maps.LatLngLiteral[],
  origin: google.maps.LatLngLiteral,
  dest: google.maps.LatLngLiteral,
): google.maps.LatLngLiteral[] {
  if (pts.length < 2) return pts;
  const d2 = (p: google.maps.LatLngLiteral, q: google.maps.LatLngLiteral) => {
    const dx = p.lat - q.lat;
    const dy = p.lng - q.lng;
    return dx * dx + dy * dy;
  };
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const forwardFit = d2(first, origin) + d2(last, dest);
  const backwardFit = d2(first, dest) + d2(last, origin);
  if (backwardFit < forwardFit) {
    return [...pts].reverse();
  }
  return pts;
}

const PLAN_ROUTE_CONNECTOR_MIN_METERS = 5;

export function buildPlanItineraryRouteConnectorPaths({
  path,
  origin,
  dest,
}: {
  path: readonly google.maps.LatLngLiteral[];
  origin: google.maps.LatLngLiteral | undefined;
  dest: google.maps.LatLngLiteral | undefined;
}): google.maps.LatLngLiteral[][] {
  if (!origin || !dest) return [];
  if (path.length === 0) return [[origin, dest]];

  const first = path[0]!;
  const last = path[path.length - 1]!;
  const out: google.maps.LatLngLiteral[][] = [];
  if (haversineMeters(origin, first) >= PLAN_ROUTE_CONNECTOR_MIN_METERS) {
    out.push([origin, first]);
  }
  if (haversineMeters(last, dest) >= PLAN_ROUTE_CONNECTOR_MIN_METERS) {
    out.push([last, dest]);
  }
  return out;
}

export async function decodePlanSegmentPathLatLng(
  encodedPolyline: string | undefined,
): Promise<google.maps.LatLngLiteral[]> {
  const encoded = encodedPolyline?.trim() ?? "";
  if (!encoded.length) return [];

  try {
    const { encoding } = (await google.maps.importLibrary(
      "geometry",
    )) as unknown as PlanGeometryLibrary;
    return encoding
      .decodePath(encoded)
      .map((point) => ({ lat: point.lat(), lng: point.lng() }));
  } catch {
    return [];
  }
}

function mixRgbTowardsBlack(hex: string, blend: number): string {
  const h = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "#591016";
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const t = Math.max(0, Math.min(1, blend));
  return `#${[r, g, b]
    .map((c) =>
      Math.round(c * (1 - t)).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

export function buildPlanItineraryRouteArrowIcons(
  routeStrokeHex: string,
): google.maps.IconSequence[] {
  const strokeDark = mixRgbTowardsBlack(routeStrokeHex.trim(), 0.22);
  return [
    {
      icon: {
        path: 1 satisfies google.maps.SymbolPath,
        fillColor: "#ffffff",
        fillOpacity: 0.96,
        strokeColor: strokeDark,
        strokeOpacity: 0.95,
        strokeWeight: 1.5,
        scale: 3,
      },
      repeat: "70px",
    },
  ];
}

export function buildPlanItineraryRouteConnectorDotIcons(
  routeStrokeHex: string,
): google.maps.IconSequence[] {
  const color = routeStrokeHex.trim() || "#f12d33";
  return [
    {
      icon: {
        path: 0 satisfies google.maps.SymbolPath,
        fillColor: color,
        fillOpacity: 0.8,
        strokeColor: "#ffffff",
        strokeOpacity: 0.95,
        strokeWeight: 1,
        scale: 5,
      },
      offset: "0",
      repeat: "18px",
    },
  ];
}

export const PLAN_ITINERARY_ROUTE_ARROW_ICONS: google.maps.IconSequence[] =
  buildPlanItineraryRouteArrowIcons("#f12d33");

export async function decodeOrientedPlanItinerarySegmentPath(
  seg: PlanItinerarySegmentDescriptor,
  encodedPolyline: string | undefined,
): Promise<google.maps.LatLngLiteral[]> {
  let pts = await decodePlanSegmentPathLatLng(encodedPolyline);
  if (seg.originLocation && seg.destLocation && pts.length >= 2) {
    pts = orientPathSmallerStopToLarger(
      pts,
      seg.originLocation,
      seg.destLocation,
    );
  }
  return pts;
}
