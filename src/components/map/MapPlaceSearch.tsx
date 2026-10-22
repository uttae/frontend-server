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

export function MapPlaceSearch({ mobile, hidden = false }: Readonly<{
  mobile: boolean;
  /** PC 검색창 숨김(웹 동선보기) — 입력값·자동완성을 지키려고 언마운트하지 않는다 */
  hidden?: boolean;
}>) {
  const { confirm, invalidate, clearSearch, scopeKey, inputResetKey } = useMapPlaceSearch(mobile);
  const initialQuery = useSearchParams().get("q")?.trim() ?? "";
  const status = usePlaceSearchStore((s) => s.status);
  const error = usePlaceSearchStore((s) => s.error);
  const items = usePlaceSearchStore((s) => s.items);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmationKind = usePlaceSearchStore((s) => s.confirmationKind);
  const query = usePlaceSearchStore((s) => s.query);
  const focus = useMapPinsFocusStore((s) => s.focus);
  const { selectedPlace } = useSelectedPlace();
  const confirmation = (value: SearchConfirmation) => confirm(value);
  const retry = () => {
    if (confirmationKind === "specific") {
      // A failed server session must be replaced by fresh predictions.
      // Return to the chosen-place input instead of changing its intent to whole search.
      if (mobile) {
        flushSync(() =>
          useMobileMapSearchStore.getState().openSearch(),
        );
        useMobileMapSearchStore.getState().focusInput?.();
      } else inputRef.current?.focus();
      return;
    }
    void confirm({ query, kind: "whole", session: null, generation: 0 });
  };
  const hasFeedback = status === "pending" || status === "error" ||
    (status === "done" && !items.length);
  const feedback = hasFeedback ? (
    <SearchFeedback status={status} error={error} hasItems={items.length > 0} retry={retry} />
  ) : null;
  return (
    <>
      {mobile ? (
        <MobileMapSearch
          confirm={confirmation}
          invalidate={invalidate}
          clearSearch={clearSearch}
          scopeKey={scopeKey}
          initialQuery={initialQuery}
        />
      ) : (
        <div
          data-tutorial-target="search"
          hidden={hidden}
          className="pointer-events-auto relative min-w-0 max-w-[calc(100%-60px)] shrink-0"
        >
          <MapPlaceSearchInput
            key={`${scopeKey}:${initialQuery}`}
            initialQuery={initialQuery}
            inputRef={inputRef}
            collapsible
            autoConfirm
            scopeKey={`${scopeKey}:discover-reset:${inputResetKey}`}
            onConfirm={confirmation}
            onInvalidate={invalidate}
            onClear={clearSearch}
          />
          {feedback ? (
            <div className="absolute right-0 top-full mt-1 w-[353px] max-w-full rounded-lg border border-border-subtle bg-fill-subtle p-3">
              {feedback}
            </div>
          ) : null}
        </div>
      )}
      {mobile && feedback ? (
        <div className="absolute inset-x-[18px] top-[112px] z-20 rounded-lg border border-border-subtle bg-fill-subtle p-3">
          {feedback}
        </div>
      ) : null}
      {mobile && focus === "search" && !selectedPlace ? (
        <MobileSearchResultCarousel />
      ) : null}
    </>
  );
}

function SearchFeedback({ status, error, hasItems, retry }: Readonly<{
  status: string;
  error: string | null;
  hasItems: boolean;
  retry: () => void;
}>) {
  if (status === "pending") return <LoadingIndicator label="장소 검색 중" />;
  if (status === "error") return (
    <div role="alert" className="flex items-center gap-2 text-body-s-regular text-text">
      <span>{error}</span>
      <button type="button" className="shrink-0 cursor-pointer text-primary underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-primary" onClick={retry}>
        다시 시도
      </button>
    </div>
  );
  if (status !== "done") return null;
  if (!hasItems) return <output className="text-body-s-regular text-text-subtle">검색 결과가 없어요.</output>;
  return null;
}
