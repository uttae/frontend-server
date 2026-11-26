import { create } from "zustand";

import type { MapCenterCoords } from "./map-center-store";

export type SearchMapSnapshot = {
  center: MapCenterCoords;
  zoom: number | null;
  radius: number;
};

export type DiscoverMapSnapshot = SearchMapSnapshot & {
  bounds: google.maps.LatLngBoundsLiteral;
};

type SearchRecenterState = {
  searchSnapshot: SearchMapSnapshot | null;
  discoverSnapshot: DiscoverMapSnapshot | null;
  searchRecenterRequestId: number;
  discoverRecenterRequestId: number;
  setSearchSnapshot: (snapshot: SearchMapSnapshot | null) => void;
  clearSearchSnapshot: () => void;
  setDiscoverSnapshot: (snapshot: DiscoverMapSnapshot | null) => void;
  clearDiscoverSnapshot: () => void;
  requestSearchRecenter: () => void;
  requestDiscoverRecenter: () => void;
};

export const useSearchRecenterStore = create<SearchRecenterState>((set) => ({
  searchSnapshot: null,
  discoverSnapshot: null,
  searchRecenterRequestId: 0,
  discoverRecenterRequestId: 0,
  setSearchSnapshot: (searchSnapshot) => set({ searchSnapshot }),
  clearSearchSnapshot: () => set({ searchSnapshot: null }),
  setDiscoverSnapshot: (discoverSnapshot) => set({ discoverSnapshot }),
  clearDiscoverSnapshot: () => set({ discoverSnapshot: null }),
  requestSearchRecenter: () =>
    set((s) => ({
      searchRecenterRequestId: s.searchRecenterRequestId + 1,
    })),
  requestDiscoverRecenter: () =>
    set((s) => ({
      discoverRecenterRequestId: s.discoverRecenterRequestId + 1,
    })),
}));
