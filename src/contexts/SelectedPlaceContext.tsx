"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { SearchRankBucket } from "@/lib/analytics/context";
import type { AnalyticsSource, ItinerarySource } from "@/lib/analytics/track";
import type { SearchResultCardProps } from "@/types/place";

/** 장소 선택 직후 SelectedPlaceController가 적용하는 카메라 동작 */
export type PlaceSelectionCamera = "full" | "pan-only" | "none";

export type SetSelectedPlaceOptions = {
  /** true면 카메라 변경 없음 — 예: 지도 내장 POI 직접 클릭 */
  skipMapRecenter?: boolean;
  /**
   * true면 현재 줌은 유지한 채 장소 위치로 패닝만 함 — 예: 지도 위 핀 클릭.
   * `skipMapRecenter: true`이면 무시됩니다.
   */
  preserveMapZoom?: boolean;
  /** `add_to_itinerary`의 `interaction_source` — 장소 상세에서 일정 추가 시 사용 */
  itinerarySource?: ItinerarySource;
  /** 검색 결과 선택 순위 버킷 — `view_place` 이벤트에서 사용 */
  analyticsRankBucket?: SearchRankBucket;
  /** `view_place`의 `interaction_source` */
  analyticsSource?: AnalyticsSource;
};

type SelectedPlaceContextType = {
  selectedPlace: SearchResultCardProps | null;
  setSelectedPlace: (
    place: SearchResultCardProps | null,
    options?: SetSelectedPlaceOptions,
  ) => void;
  placeSelectionCameraRef: MutableRefObject<PlaceSelectionCamera>;
  itinerarySource: ItinerarySource | null;
  analyticsRankBucket: SearchRankBucket | null;
  analyticsSource: AnalyticsSource | null;
};

const SelectedPlaceContext = createContext<SelectedPlaceContextType>({
  selectedPlace: null,
  setSelectedPlace: () => {},
  placeSelectionCameraRef: { current: "full" },
  itinerarySource: null,
  analyticsRankBucket: null,
  analyticsSource: null,
});

export function SelectedPlaceProvider({ children }: { children: ReactNode }) {
  const [selectedPlace, setSelectedPlaceState] =
    useState<SearchResultCardProps | null>(null);
  const placeSelectionCameraRef = useRef<PlaceSelectionCamera>("full");
  const [entry, setEntry] = useState<{
    itinerarySource: ItinerarySource | null;
    analyticsRankBucket: SearchRankBucket | null;
    analyticsSource: AnalyticsSource | null;
  }>({ itinerarySource: null, analyticsRankBucket: null, analyticsSource: null });

  const setSelectedPlace = useCallback(
    (place: SearchResultCardProps | null, options?: SetSelectedPlaceOptions) => {
      if (place === null) {
        placeSelectionCameraRef.current = "full";
        setEntry({ itinerarySource: null, analyticsRankBucket: null, analyticsSource: null });
        setSelectedPlaceState(null);
        return;
      }
      setEntry({
        itinerarySource: options?.itinerarySource ?? options?.analyticsSource ?? null,
        analyticsRankBucket: options?.analyticsRankBucket ?? null,
        analyticsSource: options?.analyticsSource ?? options?.itinerarySource ?? null,
      });
      if (options?.skipMapRecenter === true) {
        placeSelectionCameraRef.current = "none";
      } else if (options?.preserveMapZoom === true) {
        placeSelectionCameraRef.current = "pan-only";
      } else {
        placeSelectionCameraRef.current = "full";
      }
      setSelectedPlaceState(place);
    },
    [],
  );

  return (
    <SelectedPlaceContext.Provider
      value={{
        selectedPlace,
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
