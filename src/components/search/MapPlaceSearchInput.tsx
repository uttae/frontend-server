"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { CircleCancelIcon, LocationIcon, SearchIcon } from "@/assets/icons";
import {
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS,
  circleLocationBias,
  fetchPlacePredictionsForRequest,
  newAutocompleteSessionToken,
} from "@/lib/placesAutocompleteSuggest";
import type { SearchConfirmation } from "@/lib/places/search-session";
import { useMapCenterStore } from "@/stores/map-center-store";
import { cn } from "@/lib/utils";

export type MapPlaceSearchInputProps = {
  onConfirm: (confirmation: SearchConfirmation) => Promise<boolean>;
  onInvalidate: (clear: boolean) => void;
  scopeKey: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  mobile?: boolean;
  initialQuery?: string;
  active?: boolean;
  autoConfirm?: boolean;
  onQueryChange?: (query: string) => void;
};
type Suggestions = {
  query: string;
  items: google.maps.places.PlacePrediction[];
  session: object;
  status: "done" | "error";
};

/** Shared web/mobile map search. Original input and prediction/token identity survive confirmation. */
export function MapPlaceSearchInput({
  onConfirm,
  onInvalidate,
  scopeKey,
  inputRef,
  mobile = false,
  initialQuery = "",
  active: enabled = true,
  autoConfirm = false,
  onQueryChange,
}: MapPlaceSearchInputProps) {
  const placesLib = useMapsLibrary("places");
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(Boolean(initialQuery));
  const autoQuery = useRef(autoConfirm ? initialQuery : null);
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const token = useRef<object | null>(null);
  const confirmGeneration = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const fieldRef = inputRef ?? ownRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const currentScope = useRef(scopeKey);

  function cancel() {
    generation.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  const invalidateScope = useEffectEvent(() => {
    cancel();
    token.current = null;
    confirmGeneration.current = null;
    setValue("");
    setSuggestions(null);
    setActive(-1);
    setOpen(false);
    setPending(false);
  });
  useEffect(() => {
    if (currentScope.current !== scopeKey) {
      currentScope.current = scopeKey;
      invalidateScope();
    }
    return () => {
      cancel();
    };
  }, [scopeKey]);

  function schedule(query: string) {
    cancel();
    setSuggestions(null);
    setActive(-1);
    if (!query.trim() || !placesLib) return;
    const requestGeneration = generation.current;
    timer.current = setTimeout(() => {
      token.current ??= newAutocompleteSessionToken();
      const requestToken = token.current;
      void fetchPlacePredictionsForRequest({
        input: query.trim(),
        language: "ko",
        sessionToken:
          requestToken as google.maps.places.AutocompleteSessionToken,
        ...(mapCenter
          ? { locationBias: circleLocationBias(mapCenter, 50_000) }
          : {}),
      }).then(
        (items) => {
          if (requestGeneration === generation.current)
            setSuggestions({
              query,
              items,
              session: requestToken,
              status: "done",
            });
        },
        () => {
          if (requestGeneration === generation.current)
            setSuggestions({
              query,
              items: [],
              session: requestToken,
              status: "error",
            });
        },
      );
    }, AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS);
  }
  const retryReady = useEffectEvent(() => {
    if (value.trim() && open) schedule(value);
  });
  useEffect(() => {
    if (placesLib && enabled) retryReady();
  }, [placesLib, enabled]);
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled]);

  function update(query: string) {
    autoQuery.current = null;
    onInvalidate(!query.trim());
    setValue(query);
    onQueryChange?.(query);
    setOpen(Boolean(query.trim()));
    confirmGeneration.current = null;
    setPending(false);
    if (!query.trim()) token.current = null;
    schedule(query);
  }
  async function confirm(index: number) {
    if (!value.trim() || confirmGeneration.current !== null) return;
    const ready =
      suggestions?.query === value && suggestions.status === "done"
        ? suggestions
        : null;
    const prediction = index > 0 ? ready?.items[index - 1] : ready?.items[0];
    if (index > 0 && !prediction) return;
    const requestSession = ready?.session ?? token.current ?? {};
    cancel();
    const requestGeneration = generation.current;
    confirmGeneration.current = requestGeneration;
    token.current = null;
    setPending(true);
    setOpen(false);
    fieldRef.current?.blur();
    try {
      await onConfirm({
        query: value.trim(),
        kind: index > 0 ? "specific" : "whole",
        prediction,
        session: requestSession,
        generation: requestGeneration,
      });
    } finally {
      if (generation.current === requestGeneration) {
        setPending(false);
        confirmGeneration.current = null;
      }
    }
  }
  const confirmInitial = useEffectEvent(() => {
    if (
      autoQuery.current &&
      autoQuery.current === value &&
      suggestions?.query === value
    ) {
      autoQuery.current = null;
      void confirm(-1);
    }
  });
  useEffect(() => {
    confirmInitial();
  }, [suggestions]);
  const rows = suggestions?.query === value ? suggestions.items : [];
  const showDropdown = open && Boolean(value.trim());
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        mobile ? "w-full" : "w-[400px] max-w-[calc(100vw-32px)]",
      )}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void confirm(active);
        }}
      >
        <div className="flex h-12 items-center gap-2.5 rounded-lg border border-border bg-fill-subtle pl-3.5 pr-2.5 focus-within:border-primary">
          <SearchIcon size={20} className="shrink-0 text-icon-subtle" />
          <input
            ref={fieldRef}
            type="search"
            role="combobox"
            aria-label="장소 검색어"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-activedescendant={
              active >= 0 ? `${listId}-${active}` : undefined
            }
            aria-autocomplete="list"
            aria-busy={pending}
            value={value}
            onChange={(event) => update(event.target.value)}
            onFocus={() => {
              setOpen(Boolean(value.trim()));
              if (
                !token.current &&
                confirmGeneration.current === null &&
                value.trim()
              )
                schedule(value);
            }}
            onBlur={(event) => {
              if (
                confirmGeneration.current !== null ||
                containerRef.current?.contains(
                  event.relatedTarget as Node | null,
                )
              )
                return;
              cancel();
              token.current = null;
              onInvalidate(false);
              setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActive((previous) => Math.min(rows.length, previous + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((previous) => Math.max(0, previous - 1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                void confirm(active);
              }
              if (event.key === "Escape") {
                cancel();
                token.current = null;
                onInvalidate(false);
                setOpen(false);
              }
            }}
            placeholder="떠나고 싶은 지역을 입력해주세요"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-body-m-regular text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          {value ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                update("");
                fieldRef.current?.focus();
              }}
              className="flex size-5 shrink-0 items-center justify-center"
            >
              <CircleCancelIcon size={20} className="text-icon-subtle" />
            </button>
          ) : null}
        </div>
      </form>
      {showDropdown ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="검색 추천"
          className={cn(
            "mt-2 overflow-hidden rounded-lg border border-border-subtle bg-fill-subtle",
            !mobile && "absolute inset-x-0 top-full shadow-sm",
          )}
        >
          <SuggestionRow
            id={`${listId}-0`}
            active={active === 0}
            title={`${value.trim()} 전체 결과`}
            onClick={() => void confirm(0)}
          />
          {rows.map((prediction, index) => (
            <SuggestionRow
              key={prediction.placeId}
              id={`${listId}-${index + 1}`}
              active={active === index + 1}
              title={prediction.mainText?.text ?? prediction.text.text}
              subtitle={prediction.secondaryText?.text}
              onClick={() => void confirm(index + 1)}
              place
            />
          ))}
          {suggestions?.status === "error" ? (
            <li
              role="status"
              className="px-3.5 py-3 text-caption-m-regular text-text-subtle"
            >
              검색 추천을 불러오지 못했어요. 다시 입력해주세요.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
function SuggestionRow({
  id,
  title,
  subtitle,
  active,
  onClick,
  place = false,
}: {
  id: string;
  title: string;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
  place?: boolean;
}) {
  const Icon = place ? LocationIcon : SearchIcon;
  return (
    <li
      role="option"
      id={id}
      aria-selected={active}
      className={cn("h-14", active && "bg-fill")}
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className="flex h-full w-full items-center gap-2.5 px-3.5 text-left"
      >
        <Icon size={20} className="shrink-0 text-icon-subtle" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-s-emphasis text-text">
            {title}
          </span>
          {subtitle ? (
            <span className="truncate text-caption-m-regular text-text-subtle">
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
