"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import type { MapRouteView } from "@/components/map";
import { MapCloseButton } from "@/components/map/MapCloseButton";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { usePrefetchScheduleRoutes } from "@/hooks/usePrefetchScheduleRoutes";
import { useRoomSchedules, useSchedulePlanPlaces } from "@/hooks/useRooms";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import { buildMapRouteHref, MOBILE_MAP_PATH } from "@/lib/mobile-view";
import { insertAnchorAfterItem } from "@/lib/plan/insertPosition";
import { formatMonthDayKo, summarizeExpensesForMobile } from "@/lib/plan/mobilePlanFormat";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import { readSchedulePlanPlacesFromCache } from "@/lib/plan/scheduleItemPlaces";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import {
  MobilePlanPlaceSheets,
  openPlaceExpenses,
  type MobilePlanPlaceSheet,
} from "@/app/(main)/plan/_components/mobile/MobilePlanPlaceSheets";
import { useMobileAddPlaceSearch } from "@/app/(main)/plan/_components/mobile/useMobileAddPlaceSearch";

import { MobileRouteCandidateCard } from "./MobileRouteCandidateCard";
import { MobileRouteCardCarousel } from "./MobileRouteCardCarousel";
import {
  MobileRouteEmptyDayCard,
  MobileRouteMessageCard,
  MobileRoutePlaceCard,
  MobileRoutePlaceCardSkeleton,
} from "./MobileRoutePlaceCard";
import { MobileRoutePlaceDetail } from "./MobileRoutePlaceDetail";

const EMPTY_PLACES: PlanPlace[] = [];
/** 일정 화면의 일차 색과 같은 기본값 */
const FALLBACK_DAY_COLOR = "#f12d33";

type PlaceEntry = {
  kind: "place";
  key: string;
  scheduleId: number;
  dayNumber: number;
  orderNumber: number;
  itemId: number;
  place: PlanPlace;
};
/**
 * 지도에서 고른 후보 — 넣을 자리(고른 카드 바로 뒤)에 끼운다. 장소 없는 일차면 빈 카드 자리를 대신한다.
 * `prev`: 후보 바로 앞 장소(장소 없는 일차면 null) — 이 장소 뒤에 넣는다.
 */
type CandidateEntry = {
  kind: "candidate";
  key: string;
  scheduleId: number;
  dayNumber: number;
  googlePlaceId: string;
  prev: PlaceEntry | null;
};
/** 모든 일차를 이어 붙인 카드 한 칸 — 장소가 없는 일차는 안내 카드 한 칸을 차지한다 */
type StripEntry = PlaceEntry | { kind: "empty"; key: string; scheduleId: number; dayNumber: number } | CandidateEntry;

/** 지도에서 누른 Google 장소 — `anchorKey` 카드 바로 뒤에 넣을 후보. `id`는 후보마다 새 카드 키를 만든다 */
type RouteCandidate = {
  id: number;
  googlePlaceId: string;
  location: google.maps.LatLngLiteral | null;
  anchorKey: string;
};

/**
 * 고른 카드 — 키로 찾고, 그 카드가 사라지면(삭제 등) 같은 자리(index)의 카드로 이어 간다.
 * `key`가 null이면 아직 고르지 않은 것으로 주소(`day`·`item`)를 따른다.
 */
type Focus = { key: string | null; index: number; camera: MapRouteView["camera"] };

/**
 * 모바일 지도의 경로 보기(`/map?view=route&day=N&item=ID`, Figma 5826:890).
 * 모든 일차의 장소 카드를 한 줄로 이어 넘겨 보고(일차가 끝나면 다음 일차로), 고른 카드의 일차 경로만 지도에 그린다.
 * 카드를 누르면 지도의 70%까지 펼쳐 상세를 보여 준다. 고른 카드는 주소에도 남겨 새로고침해도 이어 본다.
 * 지도는 기본 지도와 같은 것을 쓰므로 지도에 넘길 `mapRouteView`와 지도 위에 얹을 `overlay`를 함께 돌려준다.
 */
export function useMobileRouteView({
  active,
  day,
  initialItemId,
}: {
  active: boolean;
  /** 주소의 일차(1부터) — 일차 수보다 크면 마지막 일차 */
  day: number;
  /** 주소의 장소 — 일정 카드에서 들어올 때 처음 고를 장소 */
  initialItemId: number | null;
}): {
  mapRouteView: MapRouteView | undefined;
  overlay: ReactNode;
  /** 기본 지도의 경로 보기 버튼 — 1일차로 연다 */
  open: () => void;
} {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { roomId } = useCurrentRoomId();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const { setSelectedPlace } = useSelectedPlace();
  const expenses = useExpenseContext();

  const schedulesQuery = useRoomSchedules(rid || null);
  const schedules = useMemo(() => sortRoomSchedules(schedulesQuery.data ?? []), [schedulesQuery.data]);

  // 일정 목록을 불러올 때 모든 일차의 장소(미리보기 포함)가 캐시에 채워지므로 캐시만 읽는다
  const dayPlacesQueries = useQueries({
    queries: schedules.map((s) => ({
      queryKey: scheduleItemsQueryKey(rid || null, s.scheduleId),
      queryFn: () => readSchedulePlanPlacesFromCache(queryClient, rid, s.scheduleId),
      enabled: active && rid.length > 0 && schedulesQuery.isSuccess,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
  });

  const [candidate, setCandidate] = useState<RouteCandidate | null>(null);
  const candidateSeqRef = useRef(0);
  // 후보 카드가 불러오는 상세와 같은 조회 — 지도 핀은 누른 자리보다 정확한 장소 위치에 둔다
  const { data: candidateDetail } = usePlaceDetailData(candidate?.googlePlaceId);

  /** 후보를 끼우기 전 카드들 — 넣을 자리(`anchorKey`)는 여기서 찾는다 */
  const baseEntries: StripEntry[] = [];
  const placesBySchedule = new Map<number, PlanPlace[]>();
  schedules.forEach((s, dayIndex) => {
    const dayPlaces = dayPlacesQueries[dayIndex]?.data ?? EMPTY_PLACES;
    placesBySchedule.set(s.scheduleId, dayPlaces);
    const places = dayPlaces.filter(
      (p): p is PlanPlace & { itemId: number } => typeof p.itemId === "number",
    );
    if (places.length === 0) {
      baseEntries.push({ kind: "empty", key: `empty-${s.scheduleId}`, scheduleId: s.scheduleId, dayNumber: dayIndex + 1 });
      return;
    }
    places.forEach((place, index) => {
      baseEntries.push({
        kind: "place",
        key: `item-${place.itemId}`,
        scheduleId: s.scheduleId,
        dayNumber: dayIndex + 1,
        orderNumber: index + 1,
        itemId: place.itemId,
        place,
      });
    });
  });

  const { entries, anchorIndex, ghost } = insertCandidate(baseEntries, candidate);

  const [focus, setFocus] = useState<Focus>({ key: null, index: 0, camera: { kind: "fit", seq: 0 } });
  const [expanded, setExpanded] = useState(false);
  /** 카드의 ⋮·시간·메모에서 연 시트 — 일정 목록과 같은 시트를 쓴다 */
  const [routeSheet, setRouteSheet] = useState<{ scheduleId: number; sheet: MobilePlanPlaceSheet } | null>(null);

  const focusedIndex = resolveFocusedIndex(entries, focus, initialItemId, day, schedules.length);
  const focused = focusedIndex >= 0 ? entries[focusedIndex] : undefined;
  const activeScheduleId = active ? (focused?.scheduleId ?? null) : null;
  const activeDayNumber = focused?.dayNumber ?? 0;
  // 카드를 넘기는 중 가운데 카드 — 일차 탭은 이걸로 먼저 바꾸고, 지도·URL은 스냅이 멈춘 뒤 바꾼다
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const tabDayNumber = (previewIndex !== null ? entries[previewIndex]?.dayNumber : undefined) ?? activeDayNumber;
  const isExpanded = active && expanded;

  // ⋮ "일정 추가"는 일정 화면과 같은 전체 화면 검색 — 추가한 장소를 바로 고른다(목록에 생기기 전엔 같은 자리를 유지)
  const addPlace = useMobileAddPlaceSearch({
    roomId: rid,
    backLabel: "경로로 돌아가기",
    onAdded: (itemId) => focusKey(`item-${itemId}`, focusedIndex + 1),
  });

  // 고른 일차는 미리보기가 빠진 장소를 다시 채우고, 일정 화면처럼 구간 경로를 한 번에 받아 둔다
  const activePlacesQuery = useSchedulePlanPlaces(rid || null, activeScheduleId);
  const activePlaces = activePlacesQuery.data ?? EMPTY_PLACES;
  const routesReady = usePrefetchScheduleRoutes(
    rid,
    activeScheduleId ?? -1,
    activePlaces,
    activeScheduleId !== null &&
      activePlacesQuery.isSuccess &&
      !activePlacesQuery.isFetching &&
      activePlaces.length >= 2,
  );
  const locations = useMemo(
    () =>
      activePlaces.flatMap((p) =>
        p.location && typeof p.itemId === "number"
          ? [{ itemId: p.itemId, lat: p.location.lat, lng: p.location.lng }]
          : [],
      ),
    [activePlaces],
  );

  const colorBySchedule = useMemo(
    () =>
      scheduleIdsToRouteColors(
        sortedScheduleIdsForRouteColors(Object.fromEntries(schedules.map((s) => [s.scheduleId, true]))),
        rid || undefined,
      ),
    [rid, schedules],
  );
  const dayColor = (scheduleId: number) => colorBySchedule.get(scheduleId) ?? FALLBACK_DAY_COLOR;

  // 고른 카드를 주소에 남긴다 — 이동 기록은 쌓지 않는다(Next가 `useSearchParams`와 맞춰 준다)
  const focusedItemId = focused?.kind === "place" ? focused.itemId : null;
  useEffect(() => {
    if (!active || activeDayNumber === 0) return;
    window.history.replaceState(null, "", buildMapRouteHref(activeDayNumber, focusedItemId));
  }, [active, activeDayNumber, focusedItemId]);

  // 경로 보기에서는 장소 상세 시트를 쓰지 않는다 — 일반 지도에서 고른 장소가 남아 있으면 시트가 카드를 덮으므로
  // 경로 보기가 켜질 때(버튼·일정 카드·주소 어느 쪽으로 들어와도) 지운다
  useEffect(() => {
    if (active) setSelectedPlace(null);
  }, [active, setSelectedPlace]);

  function focusKey(key: string, index: number) {
    setFocus((prev) => ({ key, index, camera: { kind: "pan", seq: prev.camera.seq + 1 } }));
  }

  /** 일차가 바뀌면 그 일차 전체가 보이게, 같은 일차면 고른 장소로 지도를 옮긴다 */
  const focusEntry = (index: number, cameraKind?: "fit" | "pan") => {
    const entry = entries[index];
    if (!entry) return;
    const kind = cameraKind ?? (entry.scheduleId === focused?.scheduleId ? "pan" : "fit");
    setFocus((prev) => ({ key: entry.key, index, camera: { kind, seq: prev.camera.seq + 1 } }));
  };
  const setExpandedAndRecenter = (next: boolean) => {
    setExpanded(next);
    // 펼치면 지도가 위쪽만 보이므로 고른 장소를 다시 그 가운데로 옮긴다
    setFocus((prev) => ({
      key: prev.key ?? focused?.key ?? null,
      index: focusedIndex,
      camera: { kind: "pan", seq: prev.camera.seq + 1 },
    }));
  };

  const closeCandidate = () => {
    if (!candidate) return;
    if (focused?.kind === "candidate") {
      // 보고 있던 후보를 닫으면 넣으려던 자리(앞 카드·빈 일차)로 돌아간다
      focusKey(candidate.anchorKey, Math.max(anchorIndex, 0));
      setExpanded(false);
    }
    setCandidate(null);
  };

  async function addCandidate(): Promise<boolean> {
    if (!candidate || !ghost) return false;
    const anchor = ghost.prev
      ? insertAnchorAfterItem(placesBySchedule.get(ghost.scheduleId) ?? EMPTY_PLACES, ghost.prev.itemId)
      : null;
    const itemId = await addPlace.addAt({ scheduleId: ghost.scheduleId, anchor }, candidate.googlePlaceId, "map");
    if (itemId === null) return false;
    // 새 카드는 `addPlace`의 onAdded가 골라 강조한다 — 그사이 다른 장소를 눌렀으면 그 후보는 남긴다
    const addedId = candidate.id;
    setCandidate((current) => (current?.id === addedId ? null : current));
    return true;
  }

  // 후보 핀은 그 일차를 볼 때만 그린다
  const ghostOnMap = ghost?.scheduleId === activeScheduleId ? ghost : undefined;
  const candidateLocation = candidateDetail?.location ?? candidate?.location ?? null;

  function buildRouteView(): MapRouteView | undefined {
    if (!active) return undefined;
    return {
        scheduleId: activeScheduleId,
        color: activeScheduleId === null ? FALLBACK_DAY_COLOR : dayColor(activeScheduleId),
        focusedItemId,
        routesReady,
        onStopClick: (itemId) => {
          const index = entries.findIndex((e) => e.kind === "place" && e.itemId === itemId);
          if (index >= 0) focusEntry(index, "pan");
        },
        onCandidateClick: () => {
          const index = entries.findIndex((e) => e.kind === "candidate");
          if (index >= 0) focusEntry(index, "pan");
        },
        // 처음 들어올 때 — 일정 카드로 들어왔으면 그 장소를 가까이, 경로 보기 버튼이면 일차 전체를 보여 준다
        camera: focus.key === null ? { kind: initialItemId !== null ? "place" : "fit", seq: 0 } : focus.camera,
        locations,
        expanded: isExpanded,
        candidate:
          ghostOnMap && candidate
            ? {
                googlePlaceId: candidate.googlePlaceId,
                location: candidateLocation,
                focused: focused?.kind === "candidate",
              }
            : null,
        onPlaceClick: (googlePlaceId, location) => {
          // 이미 일정에 있는 장소면 후보 대신 그 카드를 고른다
          const placeId = normalizeGooglePlaceResourceId(googlePlaceId);
          const index = entries.findIndex(
            (e) => e.kind === "place" && normalizeGooglePlaceResourceId(e.place.googlePlaceId?.trim() ?? "") === placeId,
          );
          if (index >= 0) {
            setCandidate(null);
            focusEntry(index);
            return;
          }
          // 넣을 자리 — 지금 고른 카드 바로 뒤. 후보를 보고 있었으면 같은 자리에서 장소만 바꾼다
          if (!focused) return;
          const anchorKey = focused.kind === "candidate" && candidate ? candidate.anchorKey : focused.key;
          const nextAnchorIndex = baseEntries.findIndex((e) => e.key === anchorKey);
          const nextAnchor = baseEntries[nextAnchorIndex];
          if (!nextAnchor) return;
          candidateSeqRef.current += 1;
          const id = candidateSeqRef.current;
          setExpanded(false);
          setCandidate({ id, googlePlaceId: placeId, location, anchorKey });
          // 끼운 후보 카드로 넘긴다 — 빈 일차면 빈 카드 자리, 아니면 앞 카드 바로 뒤
          focusKey(`candidate-${id}`, nextAnchor.kind === "empty" ? nextAnchorIndex : nextAnchorIndex + 1);
        },
        onBackgroundClick: () => {
          if (candidate) closeCandidate();
        },
      };
  }

  const goToDay = (dayNumber: number) => {
    const index = entries.findIndex((e) => e.dayNumber === dayNumber);
    if (index >= 0) focusEntry(index, "fit");
  };
  const close = () => {
    setExpanded(false);
    setCandidate(null);
    setPreviewIndex(null);
    setRouteSheet(null);
    router.replace(MOBILE_MAP_PATH);
  };
  const open = () => {
    setExpanded(false);
    setCandidate(null);
    setPreviewIndex(null);
    setFocus((prev) => ({ key: null, index: 0, camera: { kind: "fit", seq: prev.camera.seq + 1 } }));
    router.replace(buildMapRouteHref(1));
  };

  const tabsRef = useRef<HTMLElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const nav = tabsRef.current;
    const tab = selectedTabRef.current;
    if (!active || !nav || !tab) return;
    // 고른 탭이 탭 줄 밖이면 탭 줄만 가로로 옮긴다 — scrollIntoView는 바깥 영역까지 스크롤해 화면이 밀릴 수 있다
    const padding = 15;
    let left: number | null = null;
    if (tab.offsetLeft - padding < nav.scrollLeft) left = tab.offsetLeft - padding;
    else if (tab.offsetLeft + tab.offsetWidth + padding > nav.scrollLeft + nav.clientWidth) {
      left = tab.offsetLeft + tab.offsetWidth + padding - nav.clientWidth;
    }
    if (left !== null) nav.scrollTo({ left, behavior: "smooth" });
  }, [active, tabDayNumber]);

  const itemExpenses = (scheduleId: number, itemId: number) =>
    expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: itemId, label: "" });

  function renderEntry(entry: StripEntry, index: number): ReactNode {
    if (entry.kind === "empty") return (
              <MobileRouteEmptyDayCard dayNumber={entry.dayNumber} />

    );
    if (entry.kind === "candidate") return (
              <MobileRouteCandidateCard
                googlePlaceId={entry.googlePlaceId}
                badgeColor={dayColor(entry.scheduleId)}
                onAdd={addCandidate}
                onClose={closeCandidate}
                expanded={isExpanded}
                onExpand={() => {
                  if (index !== focusedIndex) focusEntry(index);
                  setExpandedAndRecenter(true);
                }}
                onCollapse={() => setExpandedAndRecenter(false)}
                detailActive={index === focusedIndex}
              />

    );
    return (
              <MobileRoutePlaceCard
                place={entry.place}
                orderNumber={entry.orderNumber}
                badgeColor={dayColor(entry.scheduleId)}
                highlighted={addPlace.recentlyAddedItemId === entry.itemId}
                expenseSummary={summarizeExpensesForMobile(itemExpenses(entry.scheduleId, entry.itemId))}
                canAddExpense={expenses.canManage}
                expanded={isExpanded}
                onExpand={() => {
                  if (index !== focusedIndex) focusEntry(index);
                  setExpandedAndRecenter(true);
                }}
                onCollapse={() => setExpandedAndRecenter(false)}
                onOpenActions={() => setRouteSheet({ scheduleId: entry.scheduleId, sheet: { kind: "actions", place: entry.place } })}
                onOpenExpenses={() => openPlaceExpenses(expenses, entry.scheduleId, entry.place)}
                onEditMemo={() => setRouteSheet({ scheduleId: entry.scheduleId, sheet: { kind: "memo", place: entry.place } })}
                onEditTime={() => setRouteSheet({ scheduleId: entry.scheduleId, sheet: { kind: "time", place: entry.place } })}
                detail={isExpanded ? <MobileRoutePlaceDetail place={entry.place} active={index === focusedIndex} /> : null}
              />

    );
  }

  // 경로 보기가 아닐 때(일반 지도)는 카드를 만들지 않는다 — 장소마다 비용 요약까지 계산하므로
  function renderCards(): ReactNode {
  if (!active) {
    return null;
  } else if (schedulesQuery.isLoading || (schedules.length > 0 && entries.length === 0)) {
    return <RouteCardSlot><MobileRoutePlaceCardSkeleton /></RouteCardSlot>;
  } else if (schedulesQuery.isError) {
    return (
      <RouteCardSlot>
        <MobileRouteMessageCard tone="error" title="일정을 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." />
      </RouteCardSlot>
    );
  } else if (entries.length === 0) {
    return (
      <RouteCardSlot>
        <MobileRouteMessageCard title="일정이 없어요" description="일정 화면에서 일차를 추가해보세요." />
      </RouteCardSlot>
    );
  } else {
    return (
      <MobileRouteCardCarousel
        focusedKey={focused?.key ?? null}
        onFocusChange={(index) => focusEntry(index)}
        onPreviewChange={setPreviewIndex}
        cards={entries.map((entry, index) => ({
          key: entry.key,
          node: renderEntry(entry, index),
        }))}
      />
    );
  }

  }

  const sheetSchedule = routeSheet ? schedules.find((s) => s.scheduleId === routeSheet.scheduleId) : undefined;
  const overlay = active ? (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end pb-3.5">
        {/* 펼치면 X·일차 탭은 사라지고 카드가 그 자리까지 커진다 */}
        <div className={cn("flex flex-col transition-opacity duration-200", isExpanded && "invisible h-0 opacity-0")}>
          <div className="flex justify-end pr-[18px]">
            <MapCloseButton label="경로 보기 닫기" onClick={close} className="pointer-events-auto" />
          </div>
          <nav
            ref={tabsRef}
            aria-label="경로 일차 선택"
            // relative: 탭 위치(offsetLeft)를 탭 줄 기준으로 재서 가로 스크롤 위치를 정한다
            className="pointer-events-auto relative mb-[9px] mt-3 flex h-[34px] gap-2.5 overflow-x-auto px-[15px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {schedules.map((s, index) => {
              const selected = index + 1 === tabDayNumber;
              return (
                <button
                  key={s.scheduleId}
                  ref={selected ? selectedTabRef : undefined}
                  type="button"
                  onClick={() => goToDay(index + 1)}
                  aria-pressed={selected}
                  className={cn(
                    "shrink-0 cursor-pointer rounded-[30px] border border-border bg-fill-subtle px-3.5 py-1.5 text-label-m-emphasis",
                    selected ? "text-primary" : "text-text-disabled",
                  )}
                >
                  Day {index + 1}
                </button>
              );
            })}
          </nav>
        </div>
        {/* 접힘: 가장 긴 카드에 맞춰 모든 카드가 같은 높이 / 펼침: 지도의 70% */}
        <div className={cn("transition-[height] duration-300 ease-out", isExpanded && "h-[70%]")}>
          {renderCards()}
        </div>
      </div>

      {routeSheet && sheetSchedule ? (
        <MobilePlanPlaceSheets
          roomId={rid}
          scheduleId={routeSheet.scheduleId}
          places={placesBySchedule.get(routeSheet.scheduleId) ?? EMPTY_PLACES}
          monthDayLabel={formatMonthDayKo(sheetSchedule.date)}
          sheet={routeSheet.sheet}
          onChangeSheet={(next) => setRouteSheet(next ? { scheduleId: routeSheet.scheduleId, sheet: next } : null)}
          canInsert
          onInsertFromSearch={(anchor) => addPlace.open(routeSheet.scheduleId, anchor)}
          onPlaceAdded={(itemId) => {
            addPlace.showAddedPlace(itemId);
            focusKey(`item-${itemId}`, focusedIndex + 1);
          }}
        />
      ) : null}
      {addPlace.screen}
    </>
  ) : null;

  return { mapRouteView: buildRouteView(), overlay, open };
}

/** 카드가 하나뿐일 때도 넘기는 카드와 같은 폭·위치에 둔다 */
function RouteCardSlot({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="pointer-events-auto h-full px-[18px]">{children}</div>;
}

function insertCandidate(baseEntries: StripEntry[], candidate: RouteCandidate | null) {
  const entries = [...baseEntries];
  const anchorIndex = candidate ? baseEntries.findIndex((e) => e.key === candidate.anchorKey) : -1;
  const anchorEntry = anchorIndex >= 0 ? baseEntries[anchorIndex] : undefined;
  let ghost: CandidateEntry | undefined;
  // 넣을 자리가 사라졌으면(삭제 등) 후보도 보이지 않는다
  if (candidate && anchorEntry && anchorEntry.kind !== "candidate") {
    ghost = {
      kind: "candidate",
      key: `candidate-${candidate.id}`,
      scheduleId: anchorEntry.scheduleId,
      dayNumber: anchorEntry.dayNumber,
      googlePlaceId: candidate.googlePlaceId,
      prev: anchorEntry.kind === "place" ? anchorEntry : null,
    };
    if (anchorEntry.kind === "empty") entries.splice(anchorIndex, 1, ghost);
    else entries.splice(anchorIndex + 1, 0, ghost);
  }

  return { entries, anchorIndex, ghost };
}

function resolveFocusedIndex(entries: StripEntry[], focus: Focus, initialItemId: number | null,
  day: number, scheduleCount: number) {
  let focusedIndex: number;
  if (focus.key === null) {
    const byItem = initialItemId === null ? -1 : entries.findIndex((e) => e.kind === "place" && e.itemId === initialItemId);
    focusedIndex = byItem >= 0 ? byItem : entries.findIndex((e) => e.dayNumber === Math.min(day, scheduleCount));
  } else {
    const byKey = entries.findIndex((e) => e.key === focus.key);
    focusedIndex = byKey >= 0 ? byKey : Math.min(focus.index, entries.length - 1);
  }

  return focusedIndex;
}
