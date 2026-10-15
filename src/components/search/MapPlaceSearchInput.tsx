"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ChevronLeftIcon, CircleCancelIcon, LocationIcon, SearchIcon } from "@/assets/icons";
import { AutocompleteSearchSession, MAP_AUTOCOMPLETE_DEBOUNCE_MS } from "@/lib/places/autocomplete-session";
import type { PlacePrediction, PlaceSession, PredictionText } from "@/lib/api/place-sessions";
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
  onBack?: () => void;
  backLabel?: string;
};
type Suggestions = {
  query: string;
  items: PlacePrediction[];
  session: PlaceSession | null;
  status: "done" | "error";
  error?: string;
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
  onBack,
  backLabel = "지도로 돌아가기",
}: MapPlaceSearchInputProps) {
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const [value, setValue] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(Boolean(initialQuery));
  const autoQuery = useRef(autoConfirm ? initialQuery : null);
  const [pending, setPending] = useState(false);
  const generation = useRef(0);
  const token = useRef<AutocompleteSearchSession | null>(null);
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
    token.current?.abandon();
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
      token.current?.abandon();
      token.current = null;
    };
  }, [scopeKey]);

  function schedule(query: string) {
    cancel();
    setSuggestions(null);
    setActive(-1);
    if (!query.trim() || !mapCenter || !enabled) return;
    const requestGeneration = generation.current;
    timer.current = setTimeout(() => {
      token.current ??= new AutocompleteSearchSession();
      const flow = token.current;
      void flow.suggest(query.trim(), mapCenter, () => requestGeneration === generation.current).then(
        (result) => {
          if (result && requestGeneration === generation.current)
            setSuggestions({ query, ...result, status: "done" });
        },
        (error: unknown) => {
          if (requestGeneration === generation.current) {
            flow.abandon();
            token.current = null;
            setSuggestions({ query, items: [], session: null, status: "error", error: error instanceof Error ? error.message : undefined });
          }
        },
      );
    }, MAP_AUTOCOMPLETE_DEBOUNCE_MS);
  }
  const retryReady = useEffectEvent(() => {
    if (value.trim() && open) schedule(value);
  });
  useEffect(() => {
    if (mapCenter && enabled) retryReady();
  }, [mapCenter, enabled]);
  useEffect(() => {
    if (!enabled) {
      cancel(); token.current?.abandon(); token.current = null;
      setSuggestions(null);
    }
  }, [enabled]);

  function update(query: string) {
    autoQuery.current = null;
    onInvalidate(!query.trim());
    setValue(query);
    onQueryChange?.(query);
    setOpen(Boolean(query.trim()));
    confirmGeneration.current = null;
    setPending(false);
    if (!query.trim()) { token.current?.abandon(); token.current = null; }
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
    if (ready?.session && ready.session.expiresAt <= Date.now()) {
      token.current?.abandon(); token.current = null;
      schedule(value); return;
    }
    const requestSession = ready?.session ?? null;
    cancel();
    const requestGeneration = generation.current;
    confirmGeneration.current = requestGeneration;
    token.current?.abandon();
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
        mobile ? "flex min-h-0 w-full flex-col" : "w-[280px] max-w-[calc(100vw-32px)]",
      )}
    >
      <form
        className={mobile ? "shrink-0 px-5 pb-2 pt-4" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          void confirm(active);
        }}
      >
        <div className={cn(
          "flex items-center border border-border bg-fill-subtle focus-within:border-primary",
          mobile ? "h-12 gap-2 rounded-lg pl-3.5 pr-2.5" : "h-9 gap-1.5 rounded-md px-2.5",
        )}>
          {onBack ? (
            <button type="button" aria-label={backLabel} onClick={onBack} className="flex h-12 w-5 shrink-0 items-center justify-center">
              <ChevronLeftIcon size={20} className="text-icon-subtle" />
            </button>
          ) : <SearchIcon size={mobile ? 20 : 16} className="shrink-0 text-icon-subtle" />}
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
              token.current?.abandon(); token.current = null;
              setSuggestions(null);
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
                token.current?.abandon(); token.current = null;
                setSuggestions(null);
                onInvalidate(false);
                setOpen(false);
              }
            }}
            placeholder="장소 검색"
            autoComplete="off"
            className={cn(
              "min-w-0 flex-1 bg-transparent pr-1 text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden",
              mobile ? "text-body-m-regular" : "text-body-s-regular",
            )}
          />
          {value ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                update("");
                fieldRef.current?.focus();
              }}
              className={cn("flex h-full shrink-0 items-center justify-center", mobile ? "w-8" : "w-6")}
            >
              <CircleCancelIcon size={mobile ? 20 : 16} className="text-icon-subtle" />
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
            "bg-fill-subtle",
            mobile
              ? "min-h-0 overflow-y-auto overscroll-contain"
              : "absolute inset-x-0 top-full mt-2 max-h-[calc(100dvh-96px)] overflow-y-auto rounded-lg border border-border-subtle",
          )}
        >
          <SuggestionRow
            id={`${listId}-0`}
            active={active === 0}
            title={`${value.trim()} 모든 결과보기`}
            onClick={() => void confirm(0)}
          />
          {rows.map((prediction, index) => (
            <SuggestionRow
              key={prediction.placeId}
              id={`${listId}-${index + 1}`}
              active={active === index + 1}
              title={prediction.structuredFormat?.mainText?.text != null
                ? prediction.structuredFormat.mainText
                : prediction.text}
              subtitle={prediction.structuredFormat?.secondaryText?.text ?? undefined}
              onClick={() => void confirm(index + 1)}
              place
            />
          ))}
          {suggestions?.status === "error" ? (
            <li
              role="status"
              className="px-3.5 py-3 text-caption-m-regular text-text-subtle"
            >
              {suggestions.error ?? "검색 추천을 불러오지 못했어요. 다시 입력해주세요."}
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
  title: string | PredictionText | null;
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
      className={cn("h-14 border-b-[0.5px] border-border-subtle last:border-b-0", active && "bg-fill")}
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className="flex h-full w-full items-center gap-2.5 pl-3.5 pr-4 text-left"
      >
        <Icon size={20} className="shrink-0 text-icon-subtle" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-s-emphasis text-text">
            {typeof title === "string" ? title : <HighlightedText value={title} />}
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

/** Backend offsets count Unicode code points, not UTF-16 code units. */
function HighlightedText({ value }: { value: PredictionText | null }) {
  if (!value?.text) return null;
  const points = Array.from(value.text);
  const matches = value.matches ?? [];
  return points.map((point, index) => matches.some(match => index >= match.startOffset && index < match.endOffset)
    ? <mark key={index} className="bg-transparent font-semibold text-inherit">{point}</mark>
    : point);
}
