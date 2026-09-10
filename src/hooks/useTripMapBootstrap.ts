"use client";

import { useEffect, useMemo, useState } from "react";

import {
  readDestinationLatLngFromSession,
  writeDestinationLatLngToSession,
} from "@/lib/maps";
import { readRoomMapViewport } from "@/lib/map-room-viewport-storage";
import { useClientReady } from "./useClientReady";

const DEFAULT_MAP_CENTER = { lat: 37.5665, lng: 126.978 };
export const DESTINATION_MAP_ZOOM = 12;

/** 방별 저장 뷰포트·목적지 캐시를 먼저 사용하고 필요한 경우에만 지오코딩합니다. */
export function useTripMapBootstrap(
  roomId: string | null | undefined,
  destination: string | null | undefined,
  roomsFetched: boolean,
  geocodingLib: google.maps.GeocodingLibrary | null,
): { ready: boolean; center: google.maps.LatLngLiteral; zoom: number } {
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const dest = typeof destination === "string" ? destination.trim() : "";
  const clientReady = useClientReady();
  const stored = useMemo(() => {
    if (!clientReady || !rid || !roomsFetched) return null;
    const viewport = readRoomMapViewport(rid);
    if (viewport)
      return {
        center: { lat: viewport.lat, lng: viewport.lng },
        zoom: viewport.zoom,
      };
    const cached = dest ? readDestinationLatLngFromSession(rid, dest) : null;
    return cached ? { center: cached, zoom: DESTINATION_MAP_ZOOM } : null;
  }, [clientReady, rid, dest, roomsFetched]);
  const [geocoded, setGeocoded] = useState<{
    rid: string;
    dest: string;
    library: google.maps.GeocodingLibrary;
    center: google.maps.LatLngLiteral | null;
  } | null>(null);

  useEffect(() => {
    if (
      !clientReady ||
      !rid ||
      !roomsFetched ||
      stored ||
      !dest ||
      !geocodingLib?.Geocoder
    )
      return;
    let cancelled = false;
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: dest }, (results, status) => {
      if (cancelled) return;
      const loc = status === "OK" ? results?.[0]?.geometry?.location : null;
      const center = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
      if (center) writeDestinationLatLngToSession(rid, dest, center);
      setGeocoded({ rid, dest, library: geocodingLib, center });
    });
    return () => {
      cancelled = true;
    };
  }, [clientReady, rid, dest, roomsFetched, stored, geocodingLib]);

  if (!rid) return { ready: true, center: DEFAULT_MAP_CENTER, zoom: 13 };
  if (roomsFetched && clientReady) {
    if (stored) return { ready: true, ...stored };
    if (!dest) return { ready: true, center: DEFAULT_MAP_CENTER, zoom: 13 };
    if (
      geocoded?.rid === rid &&
      geocoded.dest === dest &&
      geocoded.library === geocodingLib
    ) {
      return {
        ready: true,
        center: geocoded.center ?? DEFAULT_MAP_CENTER,
        zoom: geocoded.center ? DESTINATION_MAP_ZOOM : 13,
      };
    }
  }
  return {
    ready: false,
    center: DEFAULT_MAP_CENTER,
    zoom: DESTINATION_MAP_ZOOM,
  };
}
