"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";
import { useSearchParams } from "next/navigation";
import { MapPlaceSearchInput } from "@/components/search/MapPlaceSearchInput";
import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import type { SearchConfirmation } from "@/lib/places/search-session";
import { useMapPlaceSearch } from "./useMapPlaceSearch";
import { MobileMapSearch } from "./MobileMapSearch";
import { MobileSearchResultCarousel } from "./MobileSearchResultCarousel";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useMapPinsFocusStore } from "@/stores/map-pins-focus-store";

export function MapPlaceSearch({ mobile }: { mobile: boolean }) {
  const { confirm, invalidate, scopeKey } = useMapPlaceSearch(mobile);
  const initialQuery = useSearchParams().get("q")?.trim() ?? "";
  const status = usePlaceSearchStore((s) => s.status);
  const error = usePlaceSearchStore((s) => s.error);
  const fallback = usePlaceSearchStore((s) => s.fallback);
  const items = usePlaceSearchStore((s) => s.items);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmationKind = usePlaceSearchStore((s) => s.confirmationKind);
  const query = usePlaceSearchStore((s) => s.query);
  const focus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace } = useSelectedPlace();
  const confirmation = (value: SearchConfirmation) => confirm(value);
  const feedback =
    status === "pending" ? (
      <LoadingIndicator label="장소 검색 중" />
    ) : status === "error" ? (
      <div
        role="alert"
        className="flex items-center gap-2 text-body-s-regular text-text"
      >
        <span>{error}</span>
        <button
          type="button"
          className="shrink-0 text-primary underline"
          onClick={() => {
            if (confirmationKind === "specific") {
              // A consumed failed SDK session must be replaced by fresh predictions.
              // Return to the chosen-place input instead of changing its intent to whole search.
              if (mobile) {
                flushSync(() =>
                  useMobileMapSearchStore.getState().openSearch(),
                );
                useMobileMapSearchStore.getState().focusInput?.();
              } else inputRef.current?.focus();
              return;
            }
            void confirm({ query, kind: "whole", session: {}, generation: 0 });
          }}
        >
          다시 시도
        </button>
      </div>
    ) : status === "done" && !items.length ? (
      <p role="status" className="text-body-s-regular text-text-subtle">
        검색 결과가 없어요.
      </p>
    ) : status === "done" && fallback ? (
      <p role="status" className="text-caption-m-regular text-text-subtle">
        현재 지도 주변의 검색 결과입니다.
      </p>
    ) : null;
  return (
    <>
      {mobile ? (
        <MobileMapSearch
          confirm={confirmation}
          invalidate={invalidate}
          scopeKey={scopeKey}
          initialQuery={initialQuery}
        />
      ) : (
        <div
          data-tutorial-target="search"
          className="absolute right-4 top-3 z-30"
        >
          <MapPlaceSearchInput
            key={`${scopeKey}:${initialQuery}`}
            initialQuery={initialQuery}
            inputRef={inputRef}
            autoConfirm
            scopeKey={scopeKey}
            onConfirm={confirmation}
            onInvalidate={invalidate}
          />
          {feedback ? (
            <div className="mt-2 rounded-lg border border-border-subtle bg-fill-subtle p-3">
              {feedback}
            </div>
          ) : null}
        </div>
      )}
      {mobile && feedback ? (
        <div className="absolute inset-x-[18px] top-[72px] z-20 rounded-lg border border-border-subtle bg-fill-subtle p-3">
          {feedback}
        </div>
      ) : null}
      {mobile && focus === "search" && !selectedPlace ? (
        <MobileSearchResultCarousel />
      ) : null}
    </>
  );
}
