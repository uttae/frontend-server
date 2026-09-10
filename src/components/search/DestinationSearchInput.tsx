"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import { useDebouncedPlacePredictions } from "@/hooks/useDebouncedPlacePredictions";
import {
  DESTINATION_INCLUDED_PRIMARY_TYPES,
  PlacePredictionInlineDescription,
} from "@/lib/placesAutocompleteSuggest";
import { cn } from "@/lib/utils";

const DESTINATION_SELECTION_HINT =
  "직접 입력은 불가하며, 검색 후 목록에서 선택해 주세요.";

type Prediction = google.maps.places.PlacePrediction;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Autocomplete에서 항목을 고르면 `placeId` 포함. 타이핑·지우기 시 `null`. */
  onResolvedPlace?: (
    place: { description: string; placeId: string } | null,
  ) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showLeadingIcon?: boolean;
  leadingIconType?: "search" | "map-pin";
  /** true면 목록에서만 선택 — 입력·드롭다운 동작 동일하게 한 줄 필드 유지 */
  selectionOnly?: boolean;
};

/**
 * Google Places Autocomplete Data API 기반 목적지 검색.
 * `includedPrimaryTypes`로 지역·행정구역·국가 등(레거시 `(regions)`에 대응).
 */
export function DestinationSearchInput({
  value,
  onChange,
  onResolvedPlace,
  placeholder = "예: 도쿄, 파리, 제주도",
  autoFocus = false,
  showLeadingIcon = true,
  leadingIconType = "map-pin",
  selectionOnly = false,
}: Props) {
  const placesLib = useMapsLibrary("places");

  const buildRequest = useCallback(
    (
      input: string,
      sessionToken: google.maps.places.AutocompleteSessionToken,
    ): google.maps.places.AutocompleteRequest => ({
      input,
      language: "ko",
      includedPrimaryTypes: [...DESTINATION_INCLUDED_PRIMARY_TYPES],
      sessionToken,
    }),
    [],
  );

  const {
    predictions,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    scheduleFetch,
    invalidateSession,
    clearSuggestionUi,
  } = useDebouncedPlacePredictions({
    placesLibReady: !!placesLib,
    minInputLength: 1,
    buildRequest,
  });

  const [inputValue, setInputValue] = useState(value);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectionOnlyFooterId = useId();

  // sync external reset (e.g. clear button from parent)
  useEffect(() => {
    if (!value) {
      queueMicrotask(() => {
        setInputValue("");
        invalidateSession();
        clearSuggestionUi();
      });
    }
  }, [value, invalidateSession, clearSuggestionUi]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);

    if (selectionOnly) {
      if (!v.trim()) {
        if (value) {
          onChange("");
        }
        onResolvedPlace?.(null);
      } else if (v !== value) {
        /** 목록 선택 전에는 제출 무효화 — 부모 `value` 문자열 유지(UI는 `inputValue` 기준). */
        onResolvedPlace?.(null);
      }
    } else {
      onChange("");
      onResolvedPlace?.(null);
    }

    scheduleFetch(v);
  }

  function handleSelect(prediction: Prediction) {
    const label = prediction.text.text;
    setInputValue(label);
    onChange(label);
    onResolvedPlace?.({ description: label, placeId: prediction.placeId });
    invalidateSession();
    clearSuggestionUi();
    setActiveIndex(-1);
  }

  function handleClear(e?: React.MouseEvent) {
    e?.stopPropagation();
    invalidateSession();
    clearSuggestionUi();
    setInputValue("");
    onChange("");
    onResolvedPlace?.(null);
    if (!selectionOnly) {
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      clearSuggestionUi();
      return;
    }

    if (!isOpen || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && predictions[activeIndex]) {
        handleSelect(predictions[activeIndex]);
      }
    }
  }

  const showDropdown = isOpen && predictions.length > 0;

  const leadingGlyph =
    showLeadingIcon && leadingIconType === "search" ? (
      <Search size={15} className="shrink-0 text-dark-gray" />
    ) : showLeadingIcon ? (
      <MapPin size={15} className="shrink-0 text-dark-gray" />
    ) : null;

  const showClear = inputValue.trim() !== "";

  return (
    <div ref={containerRef}>
      <div className="relative">
        <div
          className={cn(
            "flex w-full items-center gap-2",
            selectionOnly &&
              "rounded-xl bg-bubble-gray/60 px-3 py-2.5",
          )}
        >
          {leadingGlyph}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            {...(selectionOnly
              ? ({
                  role: "combobox" as const,
                  "aria-autocomplete": "list" as const,
                  "aria-expanded": showDropdown,
                  "aria-haspopup": "listbox" as const,
                  "aria-describedby": selectionOnlyFooterId,
                } as const)
              : {})}
            className={cn(
              "min-w-0 flex-1 text-[17px] text-dark-gray outline-none placeholder:text-light-gray",
              selectionOnly && "bg-transparent",
            )}
          />
          {showClear ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label={selectionOnly ? "선택 지우기" : "지우기"}
              className="shrink-0 rounded p-0.5 text-light-gray transition hover:text-dark-gray"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {showDropdown ? (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-gray-border bg-white shadow-lg"
          >
            {predictions.map((p, i) => (
              <li
                key={p.placeId}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={() => handleSelect(p)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-4 py-3 transition-colors ${
                  i === activeIndex
                    ? "bg-bubble-gray"
                    : "hover:bg-bubble-gray"
                }`}
              >
                <MapPin size={13} className="shrink-0 text-light-gray" />
                <span className="flex min-w-0 flex-1 items-baseline truncate">
                  <PlacePredictionInlineDescription
                    prediction={p}
                    matchClassName="font-semibold text-primary"
                    primaryTextClassName="text-base text-black"
                    secondaryTextClassName="ml-1.5 truncate text-[13px] text-light-gray"
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selectionOnly ? (
        <p
          id={selectionOnlyFooterId}
          className="mt-2 text-[14px] leading-relaxed text-light-gray"
        >
          {DESTINATION_SELECTION_HINT}
        </p>
      ) : null}
    </div>
  );
}
