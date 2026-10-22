"use client";

import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { MapSearchIcon } from "@/components/map/MapSearchIcon";
import { ChevronLeftIcon, CircleCancelIcon, SearchIcon } from "@/assets/icons";
import { AutocompleteSearchSession, MAP_AUTOCOMPLETE_DEBOUNCE_MS } from "@/lib/places/autocomplete-session";
import type { PlacePrediction, PlaceSession, PredictionText } from "@/lib/api/place-sessions";
import type { SearchConfirmation } from "@/lib/places/search-session";
import { useMapCenterStore } from "@/stores/map-center-store";
import { cn } from "@/lib/utils";

export type MapPlaceSearchInputProps = Readonly<{
  onConfirm: (confirmation: SearchConfirmation) => Promise<boolean>;
  onInvalidate: () => void;
  onClear: () => void;
  scopeKey: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  mobile?: boolean;
  collapsible?: boolean;
  initialQuery?: string;
  active?: boolean;
  autoConfirm?: boolean;
  onQueryChange?: (query: string) => void;
  onBack?: () => void;
  backLabel?: string;
}>;
type Suggestions = {
  query: string;
  items: PlacePrediction[];
  session: PlaceSession | null;
  status: "done" | "error";
  error?: string;
};

const INPUT_STYLES = {
  mobile: {
    container: "flex min-h-0 w-full flex-col",
    form: "shrink-0 px-5 pb-2 pt-4",
    field: "h-12 gap-2 rounded-lg pl-3.5 pr-2.5",
    text: "text-body-m-regular",
    clear: "h-full w-8",
    iconSize: 20,
  },
  desktop: {
    container: "w-[353px] max-w-full",
    form: undefined,
    field: "h-12 gap-2 rounded-lg pl-3.5 pr-2.5",
    text: "text-body-m-regular",
    clear: "size-8",
    iconSize: 20,
  },
} as const;

/** Shared web/mobile map search. Original input and prediction/token identity survive confirmation. */
export function MapPlaceSearchInput({
  onConfirm,
  onInvalidate,
  onClear,
  scopeKey,
  inputRef,
  mobile = false,
  collapsible = false,
  initialQuery = "",
  active: enabled = true,
  autoConfirm = false,
  onQueryChange,
  onBack,
  backLabel = "지도로 돌아가기",
}: MapPlaceSearchInputProps) {
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const [expanded, setExpanded] = useState(!collapsible || Boolean(initialQuery));
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    setExpanded(!collapsible);
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
    if (query.trim()) onInvalidate();
    else onClear();
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
      const success = await onConfirm({
        query: value.trim(),
        kind: index > 0 ? "specific" : "whole",
        prediction,
        session: requestSession,
        generation: requestGeneration,
      });
      if (success && !mobile && generation.current === requestGeneration) {
        // 결과는 유지하고 선택한 추천 이름을 Filled 상태로 보여준다.
        const confirmedValue = index > 0
          ? prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text ?? value
          : value;
        setValue(confirmedValue);
        setSuggestions(null);
        setActive(-1);
        autoQuery.current = null;
        onQueryChange?.(confirmedValue);
      }
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
  const appearance = INPUT_STYLES[mobile ? "mobile" : "desktop"];
  if (collapsible && !expanded) return (
    <button ref={triggerRef} type="button" aria-label="장소 검색 열기"
      onClick={() => {
        flushSync(() => setExpanded(true));
        fieldRef.current?.focus();
      }}
      className="flex size-[46px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary shadow-[0_2px_10px_#0000001a] hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <MapSearchIcon name="search-white" size={20}/>
    </button>
  );
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative",
        appearance.container,
      )}
    >
      <form
        className={appearance.form}
        onSubmit={(event) => {
          event.preventDefault();
          void confirm(active);
        }}
      >
        <div className={cn(
          "flex items-center border border-border bg-fill-subtle focus-within:border-primary",
          appearance.field,
        )}>
          {onBack ? (
            <button type="button" aria-label={backLabel} onClick={onBack} className="flex h-12 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary">
              <ChevronLeftIcon size={20} className="text-icon-subtle" />
            </button>
          ) : mobile ? <SearchIcon size={appearance.iconSize} className="shrink-0 text-icon-subtle" /> : <MapSearchIcon name="search" size={20} />}
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
              onInvalidate();
              setOpen(false);
              if (collapsible && !mobile && !value.trim()) setExpanded(false);
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
                onInvalidate();
                setOpen(false);
                if (collapsible && !value.trim()) {
                  flushSync(() => setExpanded(false));
                  triggerRef.current?.focus();
                }
              }
            }}
            placeholder="장소 검색"
            autoComplete="off"
            className={cn(
              "peer min-w-0 flex-1 bg-transparent pr-1 text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden",
              appearance.text,
            )}
          />
          {value ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={() => {
                update("");
                if (mobile) fieldRef.current?.focus();
                else if (collapsible) {
                  flushSync(() => setExpanded(false));
                  triggerRef.current?.focus();
                }
                else fieldRef.current?.blur();
              }}
              className={cn("flex shrink-0 cursor-pointer items-center justify-center rounded hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary", appearance.clear, !mobile && "peer-focus:hidden")}
            >
              {mobile ? <CircleCancelIcon size={appearance.iconSize} className="text-icon-subtle" /> : <MapSearchIcon name="clear" size={20}/>}
            </button>
          ) : null}
        </div>
      </form>
      {showDropdown ? <SearchSuggestions listId={listId} active={active} value={value} rows={rows}
        suggestions={suggestions} mobile={mobile} onConfirm={confirm} onActiveChange={setActive} /> : null}
    </div>
  );
}
function SearchSuggestions({ listId, active, value, rows, suggestions, mobile, onConfirm, onActiveChange }: Readonly<{
  listId: string;
  active: number;
  value: string;
  rows: PlacePrediction[];
  suggestions: Suggestions | null;
  mobile: boolean;
  onConfirm: (index: number) => Promise<void>;
  onActiveChange: (index: number) => void;
}>) {
  const iconSize = 20;
  // Editable combobox popup: native select/datalist cannot preserve the rich rows and whole-search action.
  // https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
  return (
    <ul // NOSONAR: S6819 — aria-controls/aria-activedescendant로 연결된 커스텀 combobox의 listbox.
      id={listId}
      role="listbox"
      aria-label="검색 추천"
      className={cn(
        "bg-fill-subtle",
        mobile
          ? "min-h-0 overflow-y-auto overscroll-contain"
          : "absolute inset-x-0 top-full mt-1 max-h-[calc(100dvh-96px)] overflow-y-auto rounded-lg border border-border",
      )}
    >
      <SuggestionRow
        id={`${listId}-0`}
        active={active === 0}
        iconSize={iconSize}
        title={`'${value.trim()}' 모든 결과보기`}
        onClick={() => void onConfirm(0)}
        onMouseMove={() => onActiveChange(0)}
      />
      {rows.map((prediction, index) => (
        <SuggestionRow
          key={prediction.placeId}
          id={`${listId}-${index + 1}`}
          active={active === index + 1}
          iconSize={iconSize}
          title={prediction.structuredFormat?.mainText?.text != null
            ? prediction.structuredFormat.mainText
            : prediction.text}
          subtitle={prediction.structuredFormat?.secondaryText?.text ?? undefined}
          onClick={() => void onConfirm(index + 1)}
          onMouseMove={() => onActiveChange(index + 1)}
          place
        />
      ))}
      {suggestions?.status === "error" ? (
        <li
          className="px-3.5 py-3 text-caption-m-regular text-text-subtle"
        >
          <output>{suggestions.error ?? "검색 추천을 불러오지 못했어요. 다시 입력해주세요."}</output>
        </li>
      ) : null}
    </ul>
  );
}

function SuggestionRow({
  id,
  title,
  subtitle,
  active,
  onClick,
  onMouseMove,
  place = false,
  iconSize,
}: Readonly<{
  id: string;
  title: string | PredictionText | null;
  subtitle?: string;
  active: boolean;
  onClick: () => void;
  onMouseMove: () => void;
  place?: boolean;
  iconSize: number;
}>) {
  return (
    <li // NOSONAR: S6819 — 위 listbox의 option이며 네이티브 select 내부의 option이 아니다.
      role="option"
      id={id}
      aria-selected={active}
      className={cn("h-14 border-b-[0.5px] border-border-subtle last:border-b-0", active && "bg-fill")}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        onMouseMove={onMouseMove}
        className="flex h-full w-full cursor-pointer items-center gap-2.5 pl-3.5 pr-4 text-left transition-colors active:bg-fill-strong focus-visible:outline-none"
      >
        <MapSearchIcon name={place ? "location" : "search"} size={iconSize} />
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
function HighlightedText({ value }: Readonly<{ value: PredictionText | null }>) {
  if (!value?.text) return null;
  const segments: { id: string; text: string; highlighted: boolean }[] = [];
  for (const [offset, point] of Array.from(value.text).entries()) {
    const highlighted = value.matches?.some(match => offset >= match.startOffset && offset < match.endOffset) ?? false;
    const previous = segments.at(-1);
    if (previous?.highlighted === highlighted) {
      previous.text += point;
    } else {
      segments.push({ id: `${value.text}:${offset}`, text: point, highlighted });
    }
  }
  return segments.map(segment => segment.highlighted
    ? <mark key={segment.id} className="bg-transparent font-semibold text-inherit">{segment.text}</mark>
    : segment.text);
}
