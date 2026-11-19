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
import { formatMonthDayKo, summarizePlaceExpenses } from "@/lib/plan/mobilePlanFormat";
import {
  scheduleIdsToRouteColors,
  sortedScheduleIdsForRouteColors,
} from "@/lib/plan/planRouteDayColors";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";
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
type CandidateEntry = {
  kind: "candidate";
  key: string;
  scheduleId: number;
  dayNumber: number;
  googlePlaceId: string;
  prev: PlaceEntry | null;
};
type StripEntry = PlaceEntry | { kind: "empty"; key: string; scheduleId: number; dayNumber: number } | CandidateEntry;

type RouteCandidate = {
  id: number;
  googlePlaceId: string;
  location: google.maps.LatLngLiteral | null;
  anchorKey: string;
};

type Focus = { key: string | null; index: number; camera: MapRouteView["camera"] };

export function useMobileRouteView({
  active,
  day,
  initialItemId,
}: {
  active: boolean;
  day: number;
  initialItemId: number | null;
}): {
  mapRouteView: MapRouteView | undefined;
  overlay: ReactNode;
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

  const dayPlacesQueries = useQueries({
    queries: schedules.map((s) => ({
      ...schedulePlanPlacesQueryOptions(queryClient, rid, s.scheduleId),
      enabled: active && rid.length > 0 && schedulesQuery.data !== undefined,
      refetchOnWindowFocus: false,
    })),
  });

  const [candidate, setCandidate] = useState<RouteCandidate | null>(null);
  const candidateSeqRef = useRef(0);
  const { data: candidateDetail } = usePlaceDetailData(candidate?.googlePlaceId);

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
  const [routeSheet, setRouteSheet] = useState<{ scheduleId: number; sheet: MobilePlanPlaceSheet } | null>(null);

  const focusedIndex = resolveFocusedIndex(entries, focus, initialItemId, day, schedules.length);
  const focused = focusedIndex >= 0 ? entries[focusedIndex] : undefined;
  const activeScheduleId = active ? (focused?.scheduleId ?? null) : null;
  const activeDayNumber = focused?.dayNumber ?? 0;
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const tabDayNumber = (previewIndex !== null ? entries[previewIndex]?.dayNumber : undefined) ?? activeDayNumber;
  const isExpanded = active && expanded;

  const addPlace = useMobileAddPlaceSearch({
    roomId: rid,
    backLabel: "경로로 돌아가기",
    onAdded: (itemId) => focusKey(`item-${itemId}`, focusedIndex + 1),
  });

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
      ),
    [schedules],
  );
  const dayColor = (scheduleId: number) => colorBySchedule.get(scheduleId) ?? FALLBACK_DAY_COLOR;

  const focusedItemId = focused?.kind === "place" ? focused.itemId : null;
  useEffect(() => {
    if (!active || activeDayNumber === 0) return;
    window.history.replaceState(null, "", buildMapRouteHref(activeDayNumber, focusedItemId));
  }, [active, activeDayNumber, focusedItemId]);

  useEffect(() => {
    if (active) setSelectedPlace(null);
  }, [active, setSelectedPlace]);

  function focusKey(key: string, index: number) {
    setFocus((prev) => ({ key, index, camera: { kind: "pan", seq: prev.camera.seq + 1 } }));
  }

  const focusEntry = (index: number, cameraKind?: "fit" | "pan") => {
    const entry = entries[index];
    if (!entry) return;
    const kind = cameraKind ?? (entry.scheduleId === focused?.scheduleId ? "pan" : "fit");
    setFocus((prev) => ({ key: entry.key, index, camera: { kind, seq: prev.camera.seq + 1 } }));
  };
  const setExpandedAndRecenter = (next: boolean) => {
    setExpanded(next);
    setFocus((prev) => ({
      key: prev.key ?? focused?.key ?? null,
      index: focusedIndex,
      camera: { kind: "pan", seq: prev.camera.seq + 1 },
    }));
  };

  const closeCandidate = () => {
    if (!candidate) return;
    if (focused?.kind === "candidate") {
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
    const addedId = candidate.id;
    setCandidate((current) => (current?.id === addedId ? null : current));
    return true;
  }

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
        camera: focus.key === null ? { kind: "place", seq: 0 } : focus.camera,
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
          const placeId = normalizeGooglePlaceResourceId(googlePlaceId);
          const index = entries.findIndex(
            (e) => e.kind === "place" && normalizeGooglePlaceResourceId(e.place.googlePlaceId?.trim() ?? "") === placeId,
          );
          if (index >= 0) {
            setCandidate(null);
            focusEntry(index);
            return;
          }
          if (!focused) return;
          const anchorKey = focused.kind === "candidate" && candidate ? candidate.anchorKey : focused.key;
          const nextAnchorIndex = baseEntries.findIndex((e) => e.key === anchorKey);
          const nextAnchor = baseEntries[nextAnchorIndex];
          if (!nextAnchor) return;
          candidateSeqRef.current += 1;
          const id = candidateSeqRef.current;
          setExpanded(false);
          setCandidate({ id, googlePlaceId: placeId, location, anchorKey });
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
    setFocus((prev) => ({ key: null, index: 0, camera: { kind: "place", seq: prev.camera.seq + 1 } }));
    router.replace(buildMapRouteHref(1));
  };

  const tabsRef = useRef<HTMLElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const nav = tabsRef.current;
    const tab = selectedTabRef.current;
    if (!active || !nav || !tab) return;
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
                expenseSummary={summarizePlaceExpenses(itemExpenses(entry.scheduleId, entry.itemId))}
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

  function renderCards(): ReactNode {
  if (!active) {
    return null;
  } else if (schedulesQuery.isLoading || (schedules.length > 0 && entries.length === 0)) {
    return <RouteCardSlot><MobileRoutePlaceCardSkeleton /></RouteCardSlot>;
  } else if (schedulesQuery.isLoadingError) {
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
        <div className={cn("flex flex-col transition-opacity duration-200", isExpanded && "invisible h-0 opacity-0")}>
          <div className="mb-[9px] flex items-center gap-2 pr-[18px]">
            <nav
              ref={tabsRef}
              aria-label="경로 일차 선택"
              className="pointer-events-auto relative flex h-[34px] min-w-0 flex-1 gap-2.5 overflow-x-auto px-[15px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            <MapCloseButton label="경로 보기 닫기" onClick={close} className="pointer-events-auto" />
          </div>
        </div>
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

function RouteCardSlot({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="pointer-events-auto h-full px-[18px]">{children}</div>;
}

function insertCandidate(baseEntries: StripEntry[], candidate: RouteCandidate | null) {
  const entries = [...baseEntries];
  const anchorIndex = candidate ? baseEntries.findIndex((e) => e.key === candidate.anchorKey) : -1;
  const anchorEntry = anchorIndex >= 0 ? baseEntries[anchorIndex] : undefined;
  let ghost: CandidateEntry | undefined;
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
