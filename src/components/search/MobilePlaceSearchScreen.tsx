"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

import {
  ChevronLeftIcon,
  CircleCancelIcon,
  CloseIcon,
  LocationErrorIcon,
  LocationIcon,
  SearchIcon,
  type IconProps,
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
import {
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS,
  circleLocationBias,
  fetchPlacePredictionsForRequest,
  newAutocompleteSessionToken,
} from "@/lib/placesAutocompleteSuggest";
import { cn } from "@/lib/utils";
import { useMapCenterStore } from "@/stores/map-center-store";

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

type MobilePlaceSearchScreenProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** 입력창 ref — 탭 제스처 안에서 focus해야 iOS 키보드가 뜬다 */
  inputRef: RefObject<HTMLInputElement | null>;
  /** 뒤로가기 버튼 aria-label */
  backLabel: string;
  /**
   * 자동완성·기록에서 장소를 골랐을 때. 성공하면 검색 기록에 남길 항목을, 실패하면 null을 돌려준다
   * (실패 안내는 호출한 쪽에서 한다).
   */
  onSelectPlace: (entry: MapSearchPlaceEntry) => Promise<MapSearchPlaceEntry | null>;
  /**
   * 엔터로 검색어를 확정했을 때. 없으면 엔터는 키보드만 내리고,
   * 검색어 기록을 누르면 그 검색어로 자동완성을 다시 띄운다.
   */
  onSubmitQuery?: (query: string) => void;
  /** 바뀌면 입력·자동완성을 비운다 */
  resetKey?: number;
}>;

/**
 * 모바일 전체 화면 장소 검색 — 입력하는 동안 자동완성 결과를 보여주고, 입력이 비면 검색 기록을 보여준다.
 * 닫혀도 언마운트하지 않아 다시 열면 입력·결과가 그대로 남는다.
 */
export function MobilePlaceSearchScreen({
  open,
  onClose,
  inputRef,
  backLabel,
  onSelectPlace,
  onSubmitQuery,
  resetKey = 0,
}: MobilePlaceSearchScreenProps) {
  const userId = useSessionUser().data?.id;
  const mapCenter = useMapCenterStore((s) => s.mapCenter);
  const placesLib = useMapsLibrary("places");

  const [inputValue, setInputValue] = useState("");
  const [suggest, setSuggest] = useState<SuggestState>({ status: "idle" });
  const [history, setHistory] = useState<MapSearchHistoryEntry[]>([]);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchGenRef = useRef(0);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (previousResetKey !== resetKey) {
    setPreviousResetKey(resetKey);
    setInputValue("");
    setSuggest({ status: "idle" });
  }

  useEffect(() => {
    if (open) setHistory(readMapSearchHistory(userId));
  }, [open, userId]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  function cancelPendingFetch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchGenRef.current += 1;
  }

  function scheduleFetch(value: string) {
    cancelPendingFetch();
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

  function updateInput(value: string) {
    setInputValue(value);
    scheduleFetch(value);
  }

  function handleClose() {
    inputRef.current?.blur();
    onClose();
  }

  function handleClear() {
    updateInput("");
    inputRef.current?.focus();
  }

  function commitQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed || !onSubmitQuery) return;
    setInputValue(trimmed);
    setHistory(addMapSearchHistory(userId, { type: "query", query: trimmed }));
    cancelPendingFetch();
    sessionTokenRef.current = null;
    inputRef.current?.blur();
    onSubmitQuery(trimmed);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (onSubmitQuery) commitQuery(inputValue);
    else inputRef.current?.blur();
  }

  async function handleSelect(entry: MapSearchPlaceEntry) {
    if (pickingId) return;
    setPickingId(entry.googlePlaceId);
    try {
      const saved = await onSelectPlace(entry);
      if (!saved) return;
      sessionTokenRef.current = null;
      setHistory(addMapSearchHistory(userId, saved));
      inputRef.current?.blur();
    } finally {
      setPickingId(null);
    }
  }

  const showHistory = inputValue.trim().length === 0;

  if (typeof document === "undefined") return null;

  // 헤더·하단 탭 위를 덮는 전체 화면 — 부모의 overflow/stacking에 묶이지 않도록 body로 portal
  return createPortal(
    <dialog
      open={open}
      aria-modal="true"
      aria-label="장소 검색"
      className={cn(
        "fixed inset-0 z-50 m-0 flex h-dvh w-full max-h-none max-w-none flex-col border-0 bg-fill-subtle p-0 pt-[env(safe-area-inset-top)]",
        !open && "hidden",
      )}
    >
      <form onSubmit={handleSubmit} className="shrink-0 px-2 pb-1 pt-4">
        <div className="flex h-12 items-center gap-2 rounded-full border border-border bg-fill-subtle pl-3.5 pr-2.5 focus-within:border-primary">
          <button
            type="button"
            onClick={handleClose}
            aria-label={backLabel}
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
            onChange={(e) => updateInput(e.target.value)}
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
                    onSelect={() =>
                      onSubmitQuery ? commitQuery(entry.query) : updateInput(entry.query)
                    }
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
    </dialog>,
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
}: Readonly<{
  icon: (props: IconProps) => ReactNode;
  title: string;
  subtitle?: string;
  pending?: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}>) {
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

function MessageRow({ text }: Readonly<{ text: string }>) {
  return (
    <li className={ROW_CLASS}>
      <LocationErrorIcon size={20} className="text-icon-subtle" />
      <span className="truncate pl-2.5 pr-4 text-body-s-regular text-text-subtle">{text}</span>
    </li>
  );
}
