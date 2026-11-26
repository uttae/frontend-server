"use client";

import { useCallback, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { MapPin, Search, X } from "lucide-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import { useDebouncedPlacePredictions } from "@/hooks/useDebouncedPlacePredictions";
import { DESTINATION_INCLUDED_PRIMARY_TYPES, PlacePredictionInlineDescription } from "@/lib/placesAutocompleteSuggest";
import { CloseIcon, SearchIcon } from "@/assets/icons";
import { FieldBox, FieldBoxInput, FieldBoxRow } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const DESTINATION_SELECTION_HINT = "직접 입력은 불가하며, 검색 후 목록에서 선택해 주세요.";

type Prediction = google.maps.places.PlacePrediction;

type Appearance = "default" | "field" | "emphasis";

type Props = {
  value: string;
  onChange: (value: string) => void;

  onResolvedPlace?: (place: { description: string; placeId: string } | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showLeadingIcon?: boolean;
  leadingIconType?: "search" | "map-pin";

  selectionOnly?: boolean;
} & (
  | {
      appearance?: "default" | "field";
      header?: never;
    }
  | { appearance: "emphasis"; header: ReactNode }
);

function DestinationLeadingIcon({
  show,
  type,
  appearance,
}: Readonly<{ show: boolean; type: "search" | "map-pin"; appearance: Appearance }>) {
  if (!show) return null;
  if (appearance !== "default") return <SearchIcon size={20} className="shrink-0 text-icon-subtle" />;
  const Icon = type === "search" ? Search : MapPin;
  return <Icon size={15} className="shrink-0 text-dark-gray" />;
}

function DestinationClearButton({
  appearance,
  selectionOnly,
  onClick,
}: Readonly<{
  appearance: Appearance;
  selectionOnly: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}>) {
  const isField = appearance !== "default";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={selectionOnly ? "선택 지우기" : "지우기"}
      className={
        isField
          ? "grid w-8 shrink-0 cursor-pointer place-items-center self-stretch text-icon-subtle"
          : "shrink-0 rounded p-0.5 text-light-gray transition hover:text-dark-gray"
      }
    >
      {isField ? <CloseIcon size={20} /> : <X size={14} />}
    </button>
  );
}

const HINT_CLASS_NAMES: Record<Appearance, string> = {
  default: "mt-2 text-body-s-regular mobile:text-body-xs-regular leading-relaxed text-light-gray",
  field: "mt-1 text-caption-s-regular text-text-subtle",
  emphasis: "sr-only",
};

function DestinationSelectionHint({
  id,
  appearance,
}: Readonly<{
  id: string;
  appearance: Appearance;
}>) {
  return (
    <p id={id} className={HINT_CLASS_NAMES[appearance]}>
      {DESTINATION_SELECTION_HINT}
    </p>
  );
}

export function DestinationSearchInput({
  value,
  onChange,
  onResolvedPlace,
  placeholder = "예: 도쿄, 파리, 제주도",
  autoFocus = false,
  showLeadingIcon = true,
  leadingIconType = "map-pin",
  selectionOnly = false,
  appearance = "default",
  header,
}: Readonly<Props>) {
  const isField = appearance === "field";
  const showHint = selectionOnly;
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      if (isOpen && predictions.length > 0) e.preventDefault();
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

  const showClear = inputValue.trim() !== "";

  const inputProps = {
    ref: inputRef,
    "aria-label": "목적지 검색",
    type: "text",
    value: inputValue,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    onFocus: () => predictions.length > 0 && setIsOpen(true),
    placeholder,
    autoComplete: "off",
    autoFocus,
    ...(selectionOnly
      ? ({
          role: "combobox" as const,
          "aria-autocomplete": "list" as const,
          "aria-expanded": showDropdown,
          "aria-haspopup": "listbox" as const,
          "aria-describedby": showHint ? selectionOnlyFooterId : undefined,
        } as const)
      : {}),
  } satisfies ComponentProps<"input">;
  const leadingIcon = <DestinationLeadingIcon show={showLeadingIcon} type={leadingIconType} appearance={appearance} />;
  const clearButton = showClear ? (
    <DestinationClearButton appearance={appearance} selectionOnly={selectionOnly} onClick={handleClear} />
  ) : null;

  return (
    <div ref={containerRef}>
      <div className="relative">
        {appearance === "emphasis" ? (
          <FieldBox>
            {header}
            <FieldBoxRow>
              {leadingIcon}
              <FieldBoxInput {...inputProps} />
              {clearButton}
            </FieldBoxRow>
          </FieldBox>
        ) : (
          <div
            className={cn(
              "flex w-full items-center gap-2",

              isField
                ? "h-12 rounded-md border border-border bg-fill-subtle pl-3.5 pr-2.5 focus-within:border-primary [&:has(input:not(:placeholder-shown)):not(:focus-within)]:border-primary-strong"
                : selectionOnly && "rounded-xl bg-bubble-gray/60 px-3 py-2.5",
            )}
          >
            {leadingIcon}
            <input
              {...inputProps}
              className={cn(
                "min-w-0 flex-1 text-body-m-regular text-dark-gray outline-none placeholder:text-light-gray",
                selectionOnly && "bg-transparent",

                isField && "pr-1 text-text placeholder:text-text-subtle",
              )}
            />
            {clearButton}
          </div>
        )}

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
                  i === activeIndex ? "bg-bubble-gray" : "hover:bg-bubble-gray"
                }`}
              >
                <MapPin size={13} className="shrink-0 text-light-gray" />
                <span className="flex min-w-0 flex-1 items-baseline truncate">
                  <PlacePredictionInlineDescription
                    prediction={p}
                    matchClassName="font-semibold text-primary"
                    primaryTextClassName="text-body-m-regular mobile:text-body-s-regular text-black"
                    secondaryTextClassName="ml-1.5 truncate text-body-xs-regular text-light-gray"
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {showHint ? <DestinationSelectionHint id={selectionOnlyFooterId} appearance={appearance} /> : null}
    </div>
  );
}
