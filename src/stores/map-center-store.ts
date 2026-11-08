import { create } from "zustand";

export type MapCenterCoords = { lat: number; lng: number };

type MapCenterState = {
  mapCenter: MapCenterCoords | null;
  zoom: number | null;
  /** 현재 뷰포트 기준 대략 반경(m): 중심 ↔ bounds 북동 코너 */
  radiusMeters: number | null;
  /** 현재 뷰포트 경계 — 「현 위치에서 검색」 결과를 화면 안으로 거른다 */
  bounds: google.maps.LatLngBoundsLiteral | null;
  setMapCenter: (center: MapCenterCoords) => void;
  setMapCamera: (payload: {
    mapCenter: MapCenterCoords;
    zoom: number;
    radiusMeters: number;
    bounds: google.maps.LatLngBoundsLiteral | null;
  }) => void;
};

export const useMapCenterStore = create<MapCenterState>((set) => ({
  mapCenter: null,
  zoom: null,
  radiusMeters: null,
  bounds: null,
  setMapCenter: (mapCenter) => set({ mapCenter }),
  setMapCamera: ({ mapCenter, zoom, radiusMeters, bounds }) =>
    set({ mapCenter, zoom, radiusMeters, bounds }),
}));
