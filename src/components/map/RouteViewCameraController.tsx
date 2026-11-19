"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { haversineMeters, panToWithinWorld } from "@/lib/maps";
import type { MapRouteView } from "./Map";

const ROUTE_VIEW_COLLAPSED_COVER_PX = 300;
const ROUTE_VIEW_EXPANDED_COVER_RATIO = 0.72;
const ROUTE_VIEW_EDGE_PADDING = 40;
const ROUTE_VIEW_SINGLE_PLACE_ZOOM = 15;
const ROUTE_VIEW_FIT_MIN_ZOOM = 9;

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
  panToWithinWorld(map, { lat: target.lat - (coveredPx / 2) * latDegreesPerPx, lng: target.lng });
}

function toWorldPx({ lat, lng }: google.maps.LatLngLiteral) {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: 256 * (0.5 + lng / 360), y: 256 * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) };
}

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
    if (
      fitting.length > 0 &&
      ((next.maxX - next.minX) * scale > widthPx || (next.maxY - next.minY) * scale > heightPx)
    ) {
      continue;
    }
    box = next;
    fitting.push(location);
  }
  return fitting;
}

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

  useEffect(() => {
    if (!map || !candidateFocused || candidateLat === undefined || candidateLng === undefined) return;
    const target = { lat: candidateLat, lng: candidateLng };
    const coveredPx = expanded
      ? Math.round(map.getDiv().clientHeight * ROUTE_VIEW_EXPANDED_COVER_RATIO)
      : ROUTE_VIEW_COLLAPSED_COVER_PX;
    const offset = offsetInMapPx(map, target);
    const { clientWidth, clientHeight } = map.getDiv();
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
    if (!map || locations.length === 0) return;
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
    const lats = shown.map((l) => l.lat);
    const lngs = shown.map((l) => l.lng);
    map.fitBounds(
      { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) },
      padding,
    );
  }, [map, camera.kind, camera.seq, locations, focusedItemId, expanded]);

  return null;
}
