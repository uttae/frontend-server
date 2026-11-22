"use client";

import { createContext, useCallback, useContext, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { SearchRankBucket } from "@/lib/analytics/context";
import type { AnalyticsSource, ItinerarySource } from "@/lib/analytics/track";
import type { SearchResultCardProps } from "@/types/place";

export type PlaceSelectionCamera = "full" | "pan-only" | "none";

export type SetSelectedPlaceOptions = {
  skipMapRecenter?: boolean;
  preserveMapZoom?: boolean;
  itinerarySource?: ItinerarySource;
  analyticsRankBucket?: SearchRankBucket;
  analyticsRankPending?: boolean;
  analyticsSource?: AnalyticsSource;
  onBack?: () => void;
};

type SelectedPlaceContextType = {
  selectedPlace: SearchResultCardProps | null;
  setSelectedPlace: (place: SearchResultCardProps | null, options?: SetSelectedPlaceOptions) => void;
  placeSelectionCameraRef: MutableRefObject<PlaceSelectionCamera>;
  itinerarySource: ItinerarySource | null;
  analyticsRankBucket: SearchRankBucket | null;
  analyticsRankPending: boolean;
  analyticsSource: AnalyticsSource | null;
  onBack: (() => void) | null;
};

const SelectedPlaceContext = createContext<SelectedPlaceContextType>({
  selectedPlace: null,
  setSelectedPlace: () => {},
  placeSelectionCameraRef: { current: "full" },
  itinerarySource: null,
  analyticsRankBucket: null,
  analyticsRankPending: false,
  analyticsSource: null,
  onBack: null,
});

export function SelectedPlaceProvider({ children }: { children: ReactNode }) {
  const [selectedPlaceState, setSelectedPlaceState] = useState<SearchResultCardProps | null>(null);
  const placeSelectionCameraRef = useRef<PlaceSelectionCamera>("full");
  const [entry, setEntry] = useState<{
    itinerarySource: ItinerarySource | null;
    analyticsRankBucket: SearchRankBucket | null;
    analyticsRankPending: boolean;
    analyticsSource: AnalyticsSource | null;
    onBack: (() => void) | null;
  }>({
    itinerarySource: null,
    analyticsRankBucket: null,
    analyticsRankPending: false,
    analyticsSource: null,
    onBack: null,
  });

  const setSelectedPlace = useCallback((place: SearchResultCardProps | null, options?: SetSelectedPlaceOptions) => {
    if (place === null) {
      placeSelectionCameraRef.current = "full";
      setEntry({
        itinerarySource: null,
        analyticsRankBucket: null,
        analyticsRankPending: false,
        analyticsSource: null,
        onBack: null,
      });
      setSelectedPlaceState(null);
      return;
    }
    setEntry({
      itinerarySource: options?.itinerarySource ?? options?.analyticsSource ?? null,
      analyticsRankBucket: options?.analyticsRankBucket ?? null,
      analyticsRankPending: options?.analyticsRankPending ?? false,
      analyticsSource: options?.analyticsSource ?? options?.itinerarySource ?? null,
      onBack: options?.onBack ?? null,
    });
    if (options?.skipMapRecenter === true) {
      placeSelectionCameraRef.current = "none";
    } else if (options?.preserveMapZoom === true) {
      placeSelectionCameraRef.current = "pan-only";
    } else {
      placeSelectionCameraRef.current = "full";
    }
    setSelectedPlaceState(place);
  }, []);

  return (
    <SelectedPlaceContext.Provider
      value={{
        selectedPlace: selectedPlaceState,
        setSelectedPlace,
        placeSelectionCameraRef,
        ...entry,
      }}
    >
      {children}
    </SelectedPlaceContext.Provider>
  );
}

export function useSelectedPlace() {
  return useContext(SelectedPlaceContext);
}
