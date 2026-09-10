"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Search, MapPin, X } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import { useDebouncedPlacePredictions } from "@/hooks/useDebouncedPlacePredictions";
import {
  circleLocationBias,
  PlacePredictionInlineDescription,
} from "@/lib/placesAutocompleteSuggest";

type Prediction = google.maps.places.PlacePrediction;

type MenuGeometry = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  coords: { lat: number; lng: number } | null;
  onSearch: (query: string) => void;
  /** URL `q` — 칩·공유 링크 등에서 오는 검색어와 입력창 동기화 */
  urlQuery?: string;
  /** 드롭다운에서 항목 선택 시 (플랜 장소 추가 등) */
  onPickPrediction?: (prediction: Prediction) => void;
  /** true면 검색 버튼 숨김 — 자동완성 선택만 사용 */
  pickOnly?: boolean;
  placeholder?: string;
  /** 입력창 왼쪽 아이콘 (기본: 돋보기) */
  leadingIcon?: "search" | "pin";
  /** 입력 지우기(X) 클릭 시 — 예: 검색 지도 핀 제거 */
  onClear?: () => void;
  disabled?: boolean;
};

export function PlacesSearchInput({
  coords,
  onSearch,
  urlQuery = "",
  onPickPrediction,
  pickOnly = false,
  placeholder = "장소를 검색하세요",
  leadingIcon = "search",
  onClear,
  disabled = false,
}: Props) {
  const placesLib = useMapsLibrary("places");

  const buildRequest = useCallback(
    (
      input: string,
      sessionToken: google.maps.places.AutocompleteSessionToken,
    ): google.maps.places.AutocompleteRequest => ({
      input,
      language: "ko",
      sessionToken,
      ...(coords &&
        Number.isFinite(coords.lat) &&
        Number.isFinite(coords.lng) && {
          locationBias: circleLocationBias(
            { lat: coords.lat, lng: coords.lng },
            50_000,
          ),
        }),
    }),
    [coords],
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
    minInputLength: 2,
    disabled,
    buildRequest,
  });

  const [inputValue, setInputValue] = useState("");
  const [menuGeometry, setMenuGeometry] = useState<MenuGeometry | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLUListElement>(null);

  const updateMenuGeometry = useCallback(() => {
    const el = containerRef.current;
    if (!el || !isOpen || predictions.length === 0) {
      setMenuGeometry(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const maxCap = 125;
    const minH = 48;

    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;

    const openDown = spaceBelow >= spaceAbove;

    const avail = Math.max(0, (openDown ? spaceBelow : spaceAbove) - gap);
    let maxHeight = Math.min(
      maxCap,
      avail >= minH ? Math.max(minH, avail) : avail,
    );

    let top: number;
    if (openDown) {
      top = r.bottom + gap;
    } else {
      top = r.top - gap - maxHeight;
      if (top < margin) {
        top = margin;
        maxHeight = Math.min(maxHeight, r.top - margin - gap);
      }
    }

    const maxBottom = window.innerHeight - margin;
    if (top + maxHeight > maxBottom) {
      maxHeight = Math.max(0, maxBottom - top);
    }

    setMenuGeometry({
      top,
      left: r.left,
      width: Math.max(r.width, 200),
      maxHeight,
    });
  }, [isOpen, predictions.length]);

  useEffect(() => {
    setInputValue(urlQuery);
  }, [urlQuery]);

  useLayoutEffect(() => {
    updateMenuGeometry();
  }, [updateMenuGeometry, inputValue, pickOnly]);

  useEffect(() => {
    if (!isOpen || predictions.length === 0) return;
    window.addEventListener("scroll", updateMenuGeometry, true);
    window.addEventListener("resize", updateMenuGeometry);
    return () => {
      window.removeEventListener("scroll", updateMenuGeometry, true);
      window.removeEventListener("resize", updateMenuGeometry);
    };
  }, [isOpen, predictions.length, updateMenuGeometry]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownListRef.current?.contains(t)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputValue(value);
    scheduleFetch(value);
  }

  function commitSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    invalidateSession();
    setInputValue(trimmed);
    clearSuggestionUi();
    onSearch(trimmed);
  }

  function handleSelectPrediction(prediction: Prediction) {
    if (onPickPrediction) {
      onPickPrediction(prediction);
      invalidateSession();
      setInputValue("");
      clearSuggestionUi();
      setActiveIndex(-1);
      setMenuGeometry(null);
      return;
    }
    const text =
      prediction.mainText?.text.trim() || prediction.text.text.trim();
    commitSearch(text);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pickOnly) {
      if (activeIndex >= 0 && predictions[activeIndex]) {
        handleSelectPrediction(predictions[activeIndex]);
      } else if (predictions.length === 1) {
        handleSelectPrediction(predictions[0]);
      }
      return;
    }
    commitSearch(inputValue);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleClear() {
    invalidateSession();
    clearSuggestionUi();
    setInputValue("");
    onClear?.();
    inputRef.current?.focus();
  }

  const dropdown =
    isOpen &&
    predictions.length > 0 &&
    menuGeometry &&
    typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={dropdownListRef}
            role="listbox"
            data-places-autocomplete-menu
            style={{
              position: "fixed",
              top: menuGeometry.top,
              left: menuGeometry.left,
              width: menuGeometry.width,
              maxHeight: menuGeometry.maxHeight,
              zIndex: 200,
            }}
            className="overflow-y-auto overflow-x-hidden rounded-xl border border-gray-border bg-white shadow-lg"
          >
            {predictions.map((prediction, i) => (
              <li
                key={prediction.placeId}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectPrediction(prediction);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors ${
                  i === activeIndex ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
                <span className="flex min-w-0 flex-1 items-baseline gap-0 truncate">
                  <PlacePredictionInlineDescription
                    prediction={prediction}
                    matchClassName="font-semibold text-primary-strong"
                    primaryTextClassName="text-base text-[#111827]"
                    secondaryTextClassName="ml-1.5 truncate text-[13px] text-[#9ca3af]"
                  />
                </span>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <div className="relative flex w-full min-w-0 items-center">
          {leadingIcon === "pin" ? (
            <MapPin
              className="pointer-events-none absolute left-3 h-4 w-4 text-dark-gray"
              aria-hidden
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-3 h-4 w-4 text-dark-gray"
              aria-hidden
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            disabled={disabled}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => predictions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full rounded-lg border border-gray-border bg-white py-2 pl-9 pr-8 text-[17px] outline-none placeholder:text-[#99A1AF] focus:border-primary focus:ring-2 focus:ring-primary/30 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
          />
          {inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 text-[#99A1AF] hover:text-[#364153]"
              aria-label="지우기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {!pickOnly ? (
          <button
            type="submit"
            disabled={!inputValue.trim() || disabled}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-[17px] font-medium text-white disabled:opacity-40"
          >
            검색
          </button>
        ) : null}
      </form>

      {dropdown}
    </div>
  );
}
