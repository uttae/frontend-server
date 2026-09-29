"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MobilePlaceSearchScreen } from "@/components/search/MobilePlaceSearchScreen";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import type { MapSearchPlaceEntry } from "@/lib/map-search-history";
import { fetchPlaceDetail } from "@/lib/places/place-queries";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";

import { useMobileMapTextSearch } from "./useMobileMapTextSearch";

function reopenSearch() {
  useMobileMapSearchStore.getState().openSearch();
}

/**
 * 모바일 지도 전체 화면 검색
 * - 자동완성 결과를 누르면 지도가 그 장소로 이동하고 바텀 시트가 열린다.
 * - 엔터로 확정하면 현재 지도 영역을 텍스트 검색해 결과 핀을 여러 개 띄운다.
 * 닫혀도 언마운트하지 않아 바텀 시트에서 뒤로가기로 돌아오면 입력·결과가 그대로 남는다.
 */
export function MobileMapSearch() {
  const open = useMobileMapSearchStore((s) => s.open);
  const closeSearch = useMobileMapSearchStore((s) => s.closeSearch);
  const setFocusInput = useMobileMapSearchStore((s) => s.setFocusInput);
  const submitTextSearch = useMobileMapSearchStore((s) => s.submitTextSearch);
  const textQuery = useMobileMapSearchStore((s) => s.textQuery);
  const { setSelectedPlace } = useSelectedPlace();
  const inputRef = useRef<HTMLInputElement>(null);

  useMobileMapTextSearch();

  // 지도 검색바에서 검색어를 지우면 입력창도 비운다
  const [resetKey, setResetKey] = useState(0);
  const [previousTextQuery, setPreviousTextQuery] = useState(textQuery);
  if (previousTextQuery !== textQuery) {
    setPreviousTextQuery(textQuery);
    if (!textQuery) setResetKey((k) => k + 1);
  }

  useEffect(() => {
    setFocusInput(() => inputRef.current?.focus());
    return () => {
      setFocusInput(null);
      // 지도 화면을 떠나면 닫아 둔다 — 다시 들어왔을 때 검색 화면이 떠 있지 않도록
      closeSearch();
    };
  }, [closeSearch, setFocusInput]);

  async function handleSelectPlace(
    entry: MapSearchPlaceEntry,
  ): Promise<MapSearchPlaceEntry | null> {
    try {
      const detail = await fetchPlaceDetail(entry.googlePlaceId);
      closeSearch();
      setSelectedPlace(
        {
          name: detail.name || entry.name,
          category: detail.primaryTypeDisplayName,
          rating: detail.rating,
          userRatingCount: detail.userRatingCount,
          googlePlaceId: entry.googlePlaceId,
          location: detail.location,
          address: detail.formattedAddress || entry.address,
        },
        { itinerarySource: "search", analyticsSource: "search", onBack: reopenSearch },
      );
      return {
        type: "place",
        googlePlaceId: entry.googlePlaceId,
        name: detail.name || entry.name,
        address: detail.formattedAddress || entry.address,
      };
    } catch {
      toast.error("장소 정보를 불러오지 못했어요.");
      return null;
    }
  }

  /** 엔터 검색 — 지도에 결과 핀을 띄운다 */
  function handleSubmitQuery(query: string) {
    closeSearch();
    // 열려 있던 장소 시트가 결과 핀을 가리지 않도록 닫는다
    setSelectedPlace(null);
    submitTextSearch(query);
  }

  return (
    <MobilePlaceSearchScreen
      open={open}
      onClose={closeSearch}
      inputRef={inputRef}
      backLabel="지도로 돌아가기"
      onSelectPlace={handleSelectPlace}
      onSubmitQuery={handleSubmitQuery}
      resetKey={resetKey}
    />
  );
}
