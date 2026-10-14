"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CloseIcon,
  LocationIcon,
  SearchIcon,
} from "@/assets/icons";
import { useSessionUser } from "@/hooks/useSessionUser";
import {
  addMapSearchHistory,
  mapSearchHistoryEntryKey,
  readMapSearchHistory,
  removeMapSearchHistory,
  type MapSearchHistoryEntry,
  type MapSearchPlaceEntry,
} from "@/lib/map-search-history";
import type { SearchConfirmation } from "@/lib/places/search-session";
import { MapPlaceSearchInput } from "./MapPlaceSearchInput";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { cn } from "@/lib/utils";

export type MapMobileSearchProps = {
  open: boolean;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  backLabel: string;
  onConfirm: (confirmation: SearchConfirmation) => Promise<boolean>;
  onInvalidate: (clear: boolean) => void;
  onSelectPlace: (
    entry: MapSearchPlaceEntry,
  ) => Promise<MapSearchPlaceEntry | null>;
  scopeKey: string;
  initialQuery?: string;
  resetKey?: number;
};
/** Map-only confirmation path; itinerary input consumers keep the original screen contract. */
export function MapMobileSearchScreen({
  open,
  onClose,
  inputRef,
  backLabel,
  onConfirm,
  onInvalidate,
  onSelectPlace,
  scopeKey,
  initialQuery = "",
  resetKey = 0,
}: MapMobileSearchProps) {
  const error = usePlaceSearchStore((state) => state.error);
  const userId = useSessionUser().data?.id;
  const [query, setQuery] = useState(initialQuery);
  const [history, setHistory] = useState<MapSearchHistoryEntry[]>([]);
  const [picking, setPicking] = useState(false);
  const resetInput = useEffectEvent(() => {
    setQuery(initialQuery);
  });
  useEffect(() => {
    resetInput();
  }, [scopeKey, resetKey]);
  const refresh = useEffectEvent(() => {
    setHistory(readMapSearchHistory(userId));
  });
  useEffect(() => {
    if (open) refresh();
  }, [open, userId]);
  async function confirm(confirmation: SearchConfirmation) {
    const success = await onConfirm(confirmation);
    if (success) {
      const prediction =
        confirmation.kind === "specific" ? confirmation.prediction : null;
      setHistory(
        addMapSearchHistory(
          userId,
          prediction
            ? {
                type: "place",
                googlePlaceId: prediction.placeId,
                name: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? "",
                address: prediction.structuredFormat?.secondaryText?.text ?? "",
              }
            : { type: "query", query: confirmation.query },
        ),
      );
    }
    return success;
  }
  function close() {
    onInvalidate(false);
    inputRef.current?.blur();
    onClose();
  }
  async function selectHistory(entry: MapSearchHistoryEntry) {
    if (picking) return;
    setPicking(true);
    try {
      if (entry.type === "query") {
        await confirm({
          query: entry.query,
          kind: "whole",
          session: null,
          generation: 0,
        });
      } else {
        const saved = await onSelectPlace(entry);
        if (saved) setHistory(addMapSearchHistory(userId, saved));
      }
    } finally {
      setPicking(false);
    }
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      open={open}
      aria-modal="true"
      aria-label="장소 검색"
      className={cn(
        "fixed inset-0 z-50 m-0 flex h-dvh max-h-none w-full max-w-none flex-col border-0 bg-fill-subtle p-0 pt-[env(safe-area-inset-top)]",
        !open && "hidden",
      )}
    >
      <div className="flex min-h-0 flex-col">
          <MapPlaceSearchInput
            key={`${scopeKey}:${initialQuery}:${resetKey}`}
            initialQuery={initialQuery}
            autoConfirm
            mobile
            active={open}
            inputRef={inputRef}
            scopeKey={scopeKey}
            onConfirm={confirm}
            onInvalidate={onInvalidate}
            onQueryChange={setQuery}
            onBack={close}
            backLabel={backLabel}
          />
      </div>
      {error ? (
        <div
          role="alert"
          className="mx-3 flex items-center gap-2 rounded-lg border border-border-subtle p-3 text-body-s-regular text-text"
        >
          <span>{error}</span>
          <button
            type="button"
            className="shrink-0 text-primary underline"
            onClick={() => inputRef.current?.focus()}
          >
            다시 시도
          </button>
        </div>
      ) : null}
      {!query.trim() ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-4">
          <p className="px-3 text-caption-m-regular text-text-subtle">
            검색 기록
          </p>
          <ul>
            {history.map((entry) => {
              const Icon = entry.type === "place" ? LocationIcon : SearchIcon;
              const title = entry.type === "place" ? entry.name : entry.query;
              return (
                <li
                  key={mapSearchHistoryEntryKey(entry)}
                  className="flex h-14 items-center border-b-[0.5px] border-border-subtle pl-3.5"
                >
                  <button
                    type="button"
                    disabled={picking}
                    onClick={() => void selectHistory(entry)}
                    className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Icon size={20} className="text-icon-subtle" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-s-emphasis text-text">
                        {title}
                      </span>
                      {entry.type === "place" && entry.address ? (
                        <span className="truncate text-caption-m-regular text-text-subtle">
                          {entry.address}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${title} 검색 기록 삭제`}
                    onClick={() =>
                      setHistory(removeMapSearchHistory(userId, entry))
                    }
                    className="flex size-12 shrink-0 items-center justify-center"
                  >
                    <CloseIcon size={16} className="text-icon-subtle" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </dialog>,
    document.body,
  );
}
