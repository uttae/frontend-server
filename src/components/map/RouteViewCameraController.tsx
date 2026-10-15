"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { haversineMeters, panToWithinWorld } from "@/lib/maps";
import type { MapRouteView } from "./Map";

/** 접힌 카드·일차 탭·X가 가리는 지도 아래쪽 높이 */
const ROUTE_VIEW_COLLAPSED_COVER_PX = 300;
/** 펼친 카드가 가리는 지도 높이 비율(카드 70% + 아래 여백) */
const ROUTE_VIEW_EXPANDED_COVER_RATIO = 0.72;
const ROUTE_VIEW_EDGE_PADDING = 40;
/** 장소 하나만 볼 때(장소 하나뿐인 일차·일정 카드로 들어올 때)의 줌 — 주변 길이 보이는 정도 */
const ROUTE_VIEW_SINGLE_PLACE_ZOOM = 15;
/** 일차 전체를 볼 때 가장 넓게 줄이는 줌 — 이보다 줄여야 함께 보이는 장소는 빼고 고른 장소 쪽만 맞춘다(폰에서 사방 약 80km — 도심과 공항 정도) */
const ROUTE_VIEW_FIT_MIN_ZOOM = 9;

/**
 * 가린 영역을 뺀 나머지의 가운데에 `target`이 오도록 옮긴다.
 * 지도를 막 불러온 직후엔 `getProjection()`이 없을 수 있어 줌·위도로 직접 계산한다
 * (메르카토르에서 위도 1px ≈ 경도 1px × cos(위도)).
 */
function panToVisibleCenter(
  map: google.maps.Map,
  target: google.maps.LatLngLiteral,
  coveredPx: number,
  zoom = map.getZoom(),
) {
  if (zoom === undefined || coveredPx <= 0) {
    panToWithinWorld(map, target);
    return;
  }
  const lngDegreesPerPx = 360 / (256 * 2 ** zoom);
  const latDegreesPerPx = lngDegreesPerPx * Math.cos((target.lat * Math.PI) / 180);
  // 지도 중심을 아래로 coveredPx/2만큼 내리면 target이 보이는 영역 가운데로 올라온다
  panToWithinWorld(map, { lat: target.lat - (coveredPx / 2) * latDegreesPerPx, lng: target.lng });
}

/** 줌 0의 메르카토르 세계 좌표(0~256px) */
function toWorldPx({ lat, lng }: google.maps.LatLngLiteral) {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: 256 * (0.5 + lng / 360), y: 256 * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) };
}

/**
 * `ROUTE_VIEW_FIT_MIN_ZOOM`에서 `widthPx`×`heightPx` 안에 함께 들어가는 장소 — `anchor`에서 가까운 순으로 채운다.
 * 멀리 떨어진 일차(인천공항 → 샌프란시스코 등)를 통째로 맞추면 너무 넓어지거나 두 곳의 가운데(바다·다른 대륙)만 보이므로
 * 고른 장소 쪽만 남긴다.
 */
function placesFittingAround<T extends google.maps.LatLngLiteral>(
  anchor: google.maps.LatLngLiteral,
  locations: readonly T[],
  widthPx: number,
  heightPx: number,
) {
  const scale = 2 ** ROUTE_VIEW_FIT_MIN_ZOOM;
  const byDistance = [...locations].sort((a, b) => haversineMeters(anchor, a) - haversineMeters(anchor, b));
  const fitting: T[] = [];
  let box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const location of byDistance) {
    const { x, y } = toWorldPx(location);
    const next = {
      minX: Math.min(box.minX, x),
      maxX: Math.max(box.maxX, x),
      minY: Math.min(box.minY, y),
      maxY: Math.max(box.maxY, y),
    };
    if (fitting.length > 0 && ((next.maxX - next.minX) * scale > widthPx || (next.maxY - next.minY) * scale > heightPx)) {
      continue;
    }
    box = next;
    fitting.push(location);
  }
  return fitting;
}

/** 지도 왼쪽·위쪽에서 `target`까지의 거리(px) — 지도를 아직 그리지 않았으면 null */
function offsetInMapPx(map: google.maps.Map, target: google.maps.LatLngLiteral) {
  const projection = map.getProjection();
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  if (!projection || !bounds || zoom === undefined) return null;
  const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
  const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
  const point = projection.fromLatLngToPoint(target);
  if (!topRight || !bottomLeft || !point) return null;
  const scale = 2 ** zoom;
  return { x: (point.x - bottomLeft.x) * scale, y: (point.y - topRight.y) * scale };
}

export function RouteViewCameraController({
  camera,
  locations,
  focusedItemId,
  expanded,
  candidate,
}: Pick<MapRouteView, "camera" | "locations" | "focusedItemId" | "expanded" | "candidate">) {
  const map = useMap();
  const appliedRef = useRef<{ map: google.maps.Map; key: string } | null>(null);
  const candidateFocused = candidate?.focused ?? false;
  const candidateLat = candidate?.location?.lat;
  const candidateLng = candidate?.location?.lng;

  // 후보 카드를 볼 때 — 누른 자리 그대로 두고, 카드에 가려질 때만 보이는 영역 가운데로 옮긴다
  useEffect(() => {
    if (!map || !candidateFocused || candidateLat === undefined || candidateLng === undefined) return;
    const target = { lat: candidateLat, lng: candidateLng };
    const coveredPx = expanded
      ? Math.round(map.getDiv().clientHeight * ROUTE_VIEW_EXPANDED_COVER_RATIO)
      : ROUTE_VIEW_COLLAPSED_COVER_PX;
    const offset = offsetInMapPx(map, target);
    const { clientWidth, clientHeight } = map.getDiv();
    // 핀(고르면 약 55px)이 위로 그려지므로 위쪽 여유를 두고, 좌우 가장자리에 걸려도 옮긴다
    if (
      offset &&
      offset.y > 72 &&
      offset.y < clientHeight - coveredPx - 16 &&
      offset.x > 36 &&
      offset.x < clientWidth - 36
    ) {
      return;
    }
    panToVisibleCenter(map, target, coveredPx);
  }, [map, candidateFocused, candidateLat, candidateLng, expanded]);

  useEffect(() => {
    // 후보 카드를 볼 때는 고른 장소(focusedItemId)가 없어 pan은 아무 일도 하지 않는다
    if (!map || locations.length === 0) return;
    // 같은 요청을 두 번 실행하지 않는다 — fit은 장소가 처음 채워질 때도 다시 맞춘다
    const locationsKey = locations.map((l) => `${l.itemId}:${l.lat},${l.lng}`).join("|");
    const target = locations.find((l) => l.itemId === focusedItemId);
    if (camera.kind !== "fit" && !target) return;
    const key =
      camera.kind === "fit"
        ? `fit:${camera.seq}:${expanded}:${locationsKey}`
        : `${camera.kind}:${camera.seq}:${expanded}:${target?.itemId}:${target?.lat},${target?.lng}`;
    if (appliedRef.current?.map === map && appliedRef.current.key === key) return;
    appliedRef.current = { map, key };

    const coveredPx = expanded
      ? Math.round(map.getDiv().clientHeight * ROUTE_VIEW_EXPANDED_COVER_RATIO)
      : ROUTE_VIEW_COLLAPSED_COVER_PX;
    const toLatLng = (l: (typeof locations)[number]) => ({ lat: l.lat, lng: l.lng });

    if (camera.kind === "pan") {
      if (target) panToVisibleCenter(map, toLatLng(target), coveredPx);
      return;
    }
    if (camera.kind === "place" && target) {
      map.setZoom(ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      panToVisibleCenter(map, toLatLng(target), coveredPx, ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      return;
    }
    const padding = { top: 56, right: ROUTE_VIEW_EDGE_PADDING, bottom: coveredPx + 16, left: ROUTE_VIEW_EDGE_PADDING };
    const { clientWidth, clientHeight } = map.getDiv();
    const anchor = target ?? locations[0]!;
    const shown = placesFittingAround(
      anchor,
      locations,
      clientWidth - padding.left - padding.right,
      clientHeight - padding.top - padding.bottom,
    );
    if (shown.length === 1) {
      map.setZoom(ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      panToVisibleCenter(map, toLatLng(anchor), coveredPx, ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      return;
    }
    // `LatLngBounds.extend`는 날짜변경선을 넘는 쪽이 좁으면 그쪽 범위를 잡는데, 가로 래핑을 막은 지도에선
    // 경계에 막혀 한쪽만 보인다 — 넘지 않는 범위를 리터럴로 넘긴다
    const lats = shown.map((l) => l.lat);
    const lngs = shown.map((l) => l.lng);
    map.fitBounds(
      { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) },
      padding,
    );
  }, [map, camera.kind, camera.seq, locations, focusedItemId, expanded]);

  return null;
}

