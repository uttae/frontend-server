"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { MapRouteView } from "./Map";

/** 접힌 카드·일차 탭·X가 가리는 지도 아래쪽 높이 */
const ROUTE_VIEW_COLLAPSED_COVER_PX = 300;
/** 펼친 카드가 가리는 지도 높이 비율(카드 70% + 아래 여백) */
const ROUTE_VIEW_EXPANDED_COVER_RATIO = 0.72;
const ROUTE_VIEW_EDGE_PADDING = 40;
/** 장소 하나만 볼 때(장소 하나뿐인 일차·일정 카드로 들어올 때)의 줌 — 주변 길이 보이는 정도 */
const ROUTE_VIEW_SINGLE_PLACE_ZOOM = 15;

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
    map.panTo(target);
    return;
  }
  const lngDegreesPerPx = 360 / (256 * 2 ** zoom);
  const latDegreesPerPx = lngDegreesPerPx * Math.cos((target.lat * Math.PI) / 180);
  // 지도 중심을 아래로 coveredPx/2만큼 내리면 target이 보이는 영역 가운데로 올라온다
  map.panTo({ lat: target.lat - (coveredPx / 2) * latDegreesPerPx, lng: target.lng });
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
    if (locations.length === 1) {
      map.setZoom(ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      panToVisibleCenter(map, toLatLng(locations[0]!), coveredPx, ROUTE_VIEW_SINGLE_PLACE_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    locations.forEach((l) => bounds.extend(toLatLng(l)));
    map.fitBounds(bounds, {
      top: 56,
      right: ROUTE_VIEW_EDGE_PADDING,
      bottom: coveredPx + 16,
      left: ROUTE_VIEW_EDGE_PADDING,
    });
  }, [map, camera.kind, camera.seq, locations, focusedItemId, expanded]);

  return null;
}

