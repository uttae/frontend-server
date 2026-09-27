"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { toast } from "sonner";

import {
  ChevronLeftIcon,
  CircleCancelIcon,
  CloseIcon,
  LocationErrorIcon,
  LocationIcon,
  SearchIcon,
  type IconProps,
} from "@/assets/icons";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useSessionUser } from "@/hooks/useSessionUser";
import {
  addMapSearchHistory,
  readMapSearchHistory,
  mapSearchHistoryEntryKey,
  removeMapSearchHistory,
  type MapSearchHistoryEntry,
  type MapSearchPlaceEntry,
} from "@/lib/map-search-history";
import { fetchPlaceDetail } from "@/lib/places/place-queries";
import {
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS,
  circleLocationBias,
  fetchPlacePredictionsForRequest,
  newAutocompleteSessionToken,
} from "@/lib/placesAutocompleteSuggest";
import { cn } from "@/lib/utils";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useMobileMapSearchStore } from "@/stores/mobile-map-search-store";

import { useMobileMapTextSearch } from "./useMobileMapTextSearch";

type SuggestState =
  | { status: "idle" }
  | { status: "loading"; items: MapSearchPlaceEntry[] }
  | { status: "done"; items: MapSearchPlaceEntry[] }
  | { status: "error" };

const LOCATION_BIAS_RADIUS_M = 50_000;

function predictionToEntry(
  prediction: google.maps.places.PlacePrediction,
): MapSearchPlaceEntry {
  return {
    type: "place",
    googlePlaceId: prediction.placeId,
    name: prediction.mainText?.text.trim() || prediction.text.text.trim(),
    address: prediction.secondaryText?.text.trim() ?? "",
  };
}

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
  const userId = useSessionUser().data?.id;
  const { setSelectedPlace } = useSelectedPlace();
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const placesLib = useMapsLibrary("places");

  const [inputValue, setInputValue] = useState("");
  const [suggest, setSuggest] = useState<SuggestState>({ status: "idle" });
  const [history, setHistory] = useState<MapSearchHistoryEntry[]>([]);
  const [pickingId, setPickingId] = useState<string | null>(null);

  useMobileMapTextSearch();

  // 지도 검색바에서 검색어를 지우면 입력창도 비운다
  const [previousTextQuery, setPreviousTextQuery] = useState(textQuery);
  if (previousTextQuery !== textQuery) {
    setPreviousTextQuery(textQuery);
    if (!textQuery) {
      setInputValue("");
      setSuggest({ status: "idle" });
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenRef = useRef(0);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    setFocusInput(() => inputRef.current?.focus());
    return () => {
      setFocusInput(null);
      // 지도 화면을 떠나면 닫아 둔다 — 다시 들어왔을 때 검색 화면이 떠 있지 않도록
      closeSearch();
    };
  }, [closeSearch, setFocusInput]);

  useEffect(() => {
    if (open) setHistory(readMapSearchHistory(userId));
  }, [open, userId]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function scheduleFetch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchGenRef.current += 1;
    const trimmed = value.trim();
    if (!trimmed) {
      sessionTokenRef.current = null;
      setSuggest({ status: "idle" });
      return;
    }
    setSuggest((prev) => ({
      status: "loading",
      items: prev.status === "loading" || prev.status === "done" ? prev.items : [],
    }));
    if (!placesLib) return;

    const gen = fetchGenRef.current;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        sessionTokenRef.current ??= newAutocompleteSessionToken();
        try {
          const predictions = await fetchPlacePredictionsForRequest({
            input: trimmed,
            language: "ko",
            sessionToken: sessionTokenRef.current,
            ...(mapCenter && {
              locationBias: circleLocationBias(mapCenter, LOCATION_BIAS_RADIUS_M),
            }),
          });
          if (fetchGenRef.current !== gen) return;
          setSuggest({ status: "done", items: predictions.map(predictionToEntry) });
        } catch {
          if (fetchGenRef.current !== gen) return;
          setSuggest({ status: "error" });
        }
      })();
    }, AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS);
  }

  function handleClose() {
    inputRef.current?.blur();
    closeSearch();
  }

  function handleClear() {
    setInputValue("");
    scheduleFetch("");
    inputRef.current?.focus();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    commitTextSearch(inputValue);
  }

  /** 엔터 검색 — 검색 기록에 남기고 지도에 결과 핀을 띄운다 */
  function commitTextSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setInputValue(trimmed);
    setHistory(addMapSearchHistory(userId, { type: "query", query: trimmed }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchGenRef.current += 1;
    sessionTokenRef.current = null;
    inputRef.current?.blur();
    closeSearch();
    // 열려 있던 장소 시트가 결과 핀을 가리지 않도록 닫는다
    setSelectedPlace(null);
    submitTextSearch(trimmed);
  }

  async function handleSelect(entry: MapSearchPlaceEntry) {
    if (pickingId) return;
    setPickingId(entry.googlePlaceId);
    try {
      const detail = await fetchPlaceDetail(entry.googlePlaceId);
      sessionTokenRef.current = null;
      setHistory(
        addMapSearchHistory(userId, {
          type: "place",
          googlePlaceId: entry.googlePlaceId,
          name: detail.name || entry.name,
          address: detail.formattedAddress || entry.address,
        }),
      );
      inputRef.current?.blur();
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
    } catch {
      toast.error("장소 정보를 불러오지 못했어요.");
    } finally {
      setPickingId(null);
    }
  }

  const showHistory = inputValue.trim().length === 0;

  if (typeof document === "undefined") return null;

  // 헤더·하단 탭 위를 덮는 전체 화면 — 지도 섹션의 overflow/stacking에 묶이지 않도록 body로 portal
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="장소 검색"
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-fill-subtle pt-[env(safe-area-inset-top)]",
        !open && "hidden",
      )}
    >
      <form onSubmit={handleSubmit} className="shrink-0 px-2 pb-1 pt-4">
        <div className="flex h-12 items-center gap-2 rounded-full border border-border bg-fill-subtle pl-3.5 pr-2.5 focus-within:border-primary">
          <button
            type="button"
            onClick={handleClose}
            aria-label="지도로 돌아가기"
            className="-m-1 flex shrink-0 items-center justify-center p-1"
          >
            <ChevronLeftIcon size={20} className="text-icon-subtle" />
          </button>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              scheduleFetch(e.target.value);
            }}
            placeholder="떠나고 싶은 지역을 입력해주세요"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent pr-1 text-body-m-regular text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
          />
          {inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="검색어 지우기"
              className="flex h-12 w-8 shrink-0 items-center justify-center"
            >
              <CircleCancelIcon size={20} className="text-icon-subtle" />
            </button>
          ) : null}
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-5">
        {showHistory ? (
          <div className="pt-4">
            <p className="px-3 text-caption-m-regular text-text-subtle">검색 기록</p>
            <ul>
              {history.map((entry) => {
                const remove = () => setHistory(removeMapSearchHistory(userId, entry));
                return entry.type === "place" ? (
                  <SearchRow
                    key={mapSearchHistoryEntryKey(entry)}
                    icon={LocationIcon}
                    title={entry.name}
                    subtitle={entry.address}
                    pending={pickingId === entry.googlePlaceId}
                    onSelect={() => void handleSelect(entry)}
                    onRemove={remove}
                  />
                ) : (
                  <SearchRow
                    key={mapSearchHistoryEntryKey(entry)}
                    icon={SearchIcon}
                    title={entry.query}
                    onSelect={() => commitTextSearch(entry.query)}
                    onRemove={remove}
                  />
                );
              })}
            </ul>
          </div>
        ) : (
          <ul className="pt-1">
            {(suggest.status === "loading" || suggest.status === "done") &&
              suggest.items.map((entry) => (
                <SearchRow
                  key={entry.googlePlaceId}
                  icon={LocationIcon}
                  title={entry.name}
                  subtitle={entry.address}
                  pending={pickingId === entry.googlePlaceId}
                  onSelect={() => void handleSelect(entry)}
                />
              ))}
            {suggest.status === "done" && suggest.items.length === 0 && (
              <MessageRow text="검색 결과 없음" />
            )}
            {suggest.status === "error" && (
              <MessageRow text="검색 결과를 불러오지 못했어요. 다시 시도해주세요." />
            )}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}

const ROW_CLASS =
  "flex h-14 items-center border-b-[0.5px] border-border-subtle pl-3.5";

function SearchRow({
  icon: Icon,
  title,
  subtitle,
  pending = false,
  onSelect,
  onRemove,
}: {
  icon: (props: IconProps) => ReactNode;
  title: string;
  subtitle?: string;
  pending?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className={ROW_CLASS}>
      <button
        type="button"
        onClick={onSelect}
        disabled={pending}
        aria-busy={pending}
        className="flex h-full min-w-0 flex-1 items-center text-left disabled:opacity-50"
      >
        <Icon size={20} className="text-icon-subtle" />
        <span className="flex min-w-0 flex-1 flex-col pl-2.5 pr-4">
          <span className="truncate text-body-s-emphasis text-text">{title}</span>
          {subtitle ? (
            <span className="truncate text-caption-m-regular text-text-subtle">{subtitle}</span>
          ) : null}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${title} 검색 기록 삭제`}
          className="flex size-12 shrink-0 items-center justify-center"
        >
          <CloseIcon size={16} className="text-icon-subtle" />
        </button>
      ) : null}
    </li>
  );
}

function MessageRow({ text }: { text: string }) {
  return (
    <li className={ROW_CLASS}>
      <LocationErrorIcon size={20} className="text-icon-subtle" />
      <span className="truncate pl-2.5 pr-4 text-body-s-regular text-text-subtle">{text}</span>
    </li>
  );
}
