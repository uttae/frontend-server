/// <reference types="google.maps" />

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
  } catch {
    /* quota / privacy mode */
  }
}

function destinationCacheKey(roomId: string): string {
  return roomId.trim();
}

/** 방 + 목적지 문자열 단위로 한 번 찍은 지오코드를 세션 동안 재사용 (새로고침 깜빡임 완화) */
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

/** `google.maps.Map` minZoom — 전 세계 한 화면 이하 축소 방지 */
export const MAP_MIN_ZOOM = 3;
/** `google.maps.Map` maxZoom — 로드맵에서 흔한 상한 */
export const MAP_MAX_ZOOM = 21;

type GoogleMapsDirectionsTravelMode =
  | "WALKING"
  | "TRANSIT"
  | "DRIVING"
  | "BICYCLING";

const GOOGLE_MAPS_DIRECTIONS_TRAVEL_MODE = {
  WALKING: "walking",
  TRANSIT: "transit",
  DRIVING: "driving",
  BICYCLING: "bicycling",
} as const satisfies Record<GoogleMapsDirectionsTravelMode, string>;

/** Place ID로 Google Maps 장소 상세 URL을 만든다. */
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

/** 두 Place ID와 이동수단으로 Google Maps 길찾기 URL을 만든다. */
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

/**
 * Web Mercator 타일이 있는 위·경도 범위 — 극지·회색 영역 패닝 방지.
 * 경도는 ±180이 아닌 안쪽 값 — ±180은 latitude-only restriction으로 가로 래핑될 수 있음.
 */
export const MAP_WORLD_LAT_LNG_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 85,
  south: -85,
  west: -179.999,
  east: 179.999,
};

/**
 * 가로 래핑도 이 restriction만으로 막는다. `center_changed`에서 bounds를 보고 되돌리지 않는다 —
 * 휠·트랙패드 확대는 `setCenter` 뒤에 `setZoom`이 와서 그 사이 bounds(새 중심·이전 줌)가 날짜변경선을 넘은 것처럼 보이고,
 * 이때 되돌리면 확대가 끊겨 줌 값만 바뀌고 화면은 멈춘다.
 */
export const MAP_PAN_RESTRICTION: google.maps.MapRestriction = {
  latLngBounds: MAP_WORLD_LAT_LNG_BOUNDS,
  strictBounds: true,
};

/**
 * 가로 래핑을 막은 지도({@link MAP_PAN_RESTRICTION})에서 `target`으로 옮긴다.
 * `panTo`는 날짜변경선(경도 ±180)을 넘는 쪽이 더 가까우면 그쪽으로 가다 경계에 막혀 바다 한가운데에 멈추므로
 * (예: 샌프란시스코 → 도쿄), 그때만 `setCenter`로 바로 옮긴다. 이만큼 먼 이동은 `panTo`도 애니메이션 없이 건너뛴다.
 */
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

/** `panTo`가 애니메이션으로 옮기는 최대 거리 — 지도 한 화면(가로·세로) 대비 거리, 실측 1.5화면 */
const PAN_ANIMATION_MAX_SCREENS = 1.5;
/** `panTo`와 같은 이동 시간 — 화면 대비 거리에 비례한다(실측 0.66화면 약 0.55초, 1.4화면 약 1.1초) */
const PAN_ANIMATION_BASE_MS = 100;
const PAN_ANIMATION_MS_PER_SCREEN = 690;

/** 지도마다 진행 중인 이동 — 새 이동이 오면 멈추고, 같은 곳으로 가는 중이면 이어서 둔다 */
const activeMoves = new WeakMap<google.maps.Map, { target: google.maps.LatLngLiteral; stop: () => void }>();

function isSameLatLng(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
}

/**
 * PC 지도 이동은 모두 이 함수로 한다. 돌려준 함수로 멈춘다.
 * - 줌을 바꾸면 구글 이동(`panTo` + `setZoom`)을 그대로 쓴다. 래스터 지도는 줌을 소수로 못 바꿔 직접 그릴 수 없다.
 * - 경도 180도를 넘거나 1.5화면보다 멀면 바로 옮긴다({@link panToWithinWorld}, `panTo`와 같은 기준).
 * - 그 밖에는 매 프레임 `moveCamera`로 옮긴다. `panTo` 애니메이션 중에는 지도가 화면 밖에서 숨겨 둔 Advanced Marker를
 *   다시 보이지 않아 멀리 있던 핀이 도착한 뒤에야 켜지는데, 프레임마다 바로 옮기면 화면에 들어오는 대로 보인다.
 *   범위·시간은 `panTo`와 같고, 사용자가 끌거나 확대·축소하거나 다른 곳에서 지도를 옮기면 멈춘다.
 */
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
    // 같은 줌으로 `setZoom`하면 `panTo` 애니메이션이 끊겨 바로 옮겨지므로 줌이 바뀔 때만 부른다
    if (zoomChanges) map.setZoom(zoom);
    return () => {};
  }
  const div = map.getDiv();
  const scale = 2 ** currentZoom;
  const screens = Math.hypot(
    ((to.x - from.x) * scale) / div.clientWidth,
    ((to.y - from.y) * scale) / div.clientHeight,
  );
  // 숨겨진 지도(크기 0)면 NaN·무한대라 함께 바로 옮긴다
  if (!(screens <= PAN_ANIMATION_MAX_SCREENS)) {
    map.setCenter(target);
    return () => {};
  }
  const duration = PAN_ANIMATION_BASE_MS + PAN_ANIMATION_MS_PER_SCREEN * screens;
  const start = performance.now();
  let frame = 0;
  // 마지막으로 옮긴 위치 — 다음 프레임에 지도가 여기서 벗어나 있으면 다른 곳에서 옮긴 것
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
    // 거의 일정하게 가다 끝에서 멈춘다(`panTo`의 감속과 비슷하게). 화면에서 직선으로 가도록 지도 좌표로 나눈다
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

/** Google Places 리소스 id(`places/…`) 접두를 제거한 레거시 id */
export function normalizeGooglePlaceResourceId(id: string): string {
  const prefix = "places/";
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/** Places API(New) JS — `displayName` 등 문자열 또는 `LocalizedText`(text) 처리 */
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

/** 구면 거리 (미터) — 지도 bounds 중심↔모서리 등 간단한 반경 추정용 */
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

/**
 * 지도 중심 기준 뷰포트에 내접하는 원의 최대 반경(m).
 * 중심에서 북·남·동·서 경계까지 거리의 최솟값 — 줌을 벗어나지 않으면서 원형 검색을 최대한 채운다.
 */
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

/** 지도 이동·줌 변경 시 「현 위치 검색」 버튼 노출 여부 */
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

/**
 * Routes `path`가 출발/도착과 반대일 때 뒤집습니다.
 * 폴리라인·화살표가 일정 순서(작은 번호 → 큰 번호) 방향을 가리키게 합니다.
 */
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

/**
 * 서버가 준 Google encoded polyline을 지도 좌표로 디코딩합니다.
 * 폴리라인은 백엔드 경로 응답에 실려 오므로 여기서 Routes API를 호출하지 않습니다.
 */
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

/**
 * 라인색에 맞춰 폴리라인 화살표 테두리를 어둡게 한다.
 */
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

/**
 * 폴리라인·일차 라인색에 맞춘 화살표 아이콘 시퀀스 (`SymbolPath.BACKWARD_CLOSED_ARROW` = path 1).
 */
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

/**
 * 레거시 기본 라인색용; 신규는 {@link buildPlanItineraryRouteArrowIcons}.
 */
export const PLAN_ITINERARY_ROUTE_ARROW_ICONS: google.maps.IconSequence[] =
  buildPlanItineraryRouteArrowIcons("#f12d33");

/** 일정 맵 폴리라인 한 구간 — 서버 폴리라인을 디코딩한 뒤 일정 순서에 맞게 방향 보정. */
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
