import { create } from "zustand";

export type MapCenterCoords = { lat: number; lng: number };

type MapCenterState = {
  mapCenter: MapCenterCoords | null;
  zoom: number | null;
  radiusMeters: number | null;
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
