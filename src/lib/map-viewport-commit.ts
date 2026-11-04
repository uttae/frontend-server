/// <reference types="google.maps" />

import { clampPlacesSearchRadiusMeters } from "@/lib/places/placesSearchRadius";
import { viewportSearchRadiusMetersFromBounds } from "@/lib/maps";
import { useMapCenterStore } from "@/stores/map-center-store";
import {
  useSearchRecenterStore,
  type DiscoverMapSnapshot,
  type SearchMapSnapshot,
} from "@/stores/search-recenter-store";

/** 검색 페이지 `GET /places/search` 의 위치 고정 스냅샷 (`map-center-store` 기준) */
export function buildSearchMapSnapshotFromMapCenterStore(): SearchMapSnapshot | null {
  const { mapCenter, zoom, radiusMeters } = useMapCenterStore.getState();
  if (!mapCenter) return null;
  const radius =
    radiusMeters != null && Number.isFinite(radiusMeters)
      ? clampPlacesSearchRadiusMeters(radiusMeters)
      : undefined;

  return {
    center: mapCenter,
    zoom: zoom ?? null,
    radius: radius ?? clampPlacesSearchRadiusMeters(5000),
  };
}

/**
 * 검색 결과를 보여 주려고 옮긴 지도가 멈추면 그 화면을 「현 위치에서 검색」 기준점으로 삼는다.
 * 기준점이 검색 요청 때 화면이면 결과로 옮기자마자(맞춤 확대·첫 결과로 이동) 버튼이 다시 보인다.
 * 옮길 곳이 지금 화면과 같으면 idle이 오지 않으므로, 그 전에 사용자가 지도를 만지면 취소해
 * 사용자가 옮긴 화면을 기준점으로 삼지 않는다. +/−는 지도 안 컨트롤이라 함께 잡힌다.
 */
export function settleSearchSnapshotAfterMove(
  map: Pick<google.maps.Map, "getDiv" | "addListener">,
): () => void {
  const div = map.getDiv();
  const cancel = () => {
    idle.remove();
    div.removeEventListener("pointerdown", cancel, true);
    div.removeEventListener("wheel", cancel, true);
  };
  const idle = map.addListener("idle", () => {
    cancel();
    const camera = buildSearchMapSnapshotFromMapCenterStore();
    const { searchSnapshot, setSearchSnapshot } = useSearchRecenterStore.getState();
    if (camera && searchSnapshot) setSearchSnapshot(camera);
  });
  div.addEventListener("pointerdown", cancel, true);
  div.addEventListener("wheel", cancel, { capture: true, passive: true });
  return cancel;
}

/** Discover(Places JS) 영역 고정 스냅샷 — 맵 현재 카메라 기준 1회 커밋 */
export function buildDiscoverSnapshotFromGoogleMap(
  map: google.maps.Map,
): DiscoverMapSnapshot | null {
  const bounds = map.getBounds();
  if (!bounds) return null;

  const boundsLiteral = bounds.toJSON();
  const center = bounds.getCenter().toJSON();
  const radius = viewportSearchRadiusMetersFromBounds(center, boundsLiteral);

  const zoomRaw = map.getZoom();
  const zoom = typeof zoomRaw === "number" ? zoomRaw : null;

  return {
    bounds: boundsLiteral,
    center,
    zoom,
    radius: clampPlacesSearchRadiusMeters(radius),
  };
}

/** Discover 스냅샷의 bounds로 Places 결과 좌표 클라이언트 필터 포함 여부 검사용 */
export function boundsInstanceFromDiscoverSnapshot(
  b: google.maps.LatLngBoundsLiteral,
): google.maps.LatLngBounds {
  return new google.maps.LatLngBounds(
    { lat: b.south, lng: b.west },
    { lat: b.north, lng: b.east },
  );
}
