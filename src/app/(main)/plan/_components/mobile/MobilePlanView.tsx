"use client";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { MobilePlaceSearchScreen } from "@/components/search/MobilePlaceSearchScreen";
import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import type { MapSearchPlaceEntry } from "@/lib/map-search-history";
import { resolveInsertIndex, type InsertAnchor } from "@/lib/plan/insertPosition";
import { formatMobileDayDate, formatMonthDayKo } from "@/lib/plan/mobilePlanFormat";
import { planCopy } from "@/lib/plan/planCopy";
import { dayNumberForInsertAfterDayIndex } from "@/lib/plan/scheduleMerge";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { useCreateRoomSchedule, useCreateScheduleItem } from "@/hooks/useRooms";
import { cn } from "@/lib/utils";
import {
  useMobilePlanDayFilterStore,
  type MobilePlanDayFilter,
} from "@/stores/mobile-plan-day-filter-store";

import { MobilePlanDaySection } from "./MobilePlanDaySection";
import { MobilePlanDragProvider, useMobilePlanDragController } from "./mobilePlanDrag";

/** 추가한 카드를 강조하는 시간 */
const ADDED_HIGHLIGHT_MS = 1500;

type MobilePlanViewProps = Readonly<{
  roomId: string;
  /** dayNumber 순으로 정렬된 일차 */
  schedules: RoomSchedule[];
  isLoading: boolean;
  isError: boolean;
  /** 일차 추가·삭제·이동 중 */
  menuDisabled: boolean;
  /** 일차 삭제 확인 다이얼로그를 연다 — 마지막 일차면 비우기 */
  onRequestDeleteDay: (dayIndex: number) => void;
}>;

/** 모바일 일정 화면 — 상단 일차 탭(전체/Day N 필터)과 일차별 장소 목록 */
export function MobilePlanView({
  roomId,
  schedules,
  isLoading,
  isError,
  menuDisabled,
  onRequestDeleteDay,
}: MobilePlanViewProps) {
  // 선택한 탭은 방별 스토어에 둬서 지도·채팅 등을 다녀와도 유지한다
  const filter = useMobilePlanDayFilterStore((s) => s.filterByRoomId[roomId] ?? "all");
  const setRoomFilter = useMobilePlanDayFilterStore((s) => s.setFilter);
  const setFilter = (next: MobilePlanDayFilter) => setRoomFilter(roomId, next);
  // 선택한 일차가 삭제되면 전체로 돌아간다
  const activeFilter =
    filter !== "all" && !schedules.some((s) => s.scheduleId === filter) ? "all" : filter;
  const visibleSchedules =
    activeFilter === "all" ? schedules : schedules.filter((s) => s.scheduleId === activeFilter);

  // 순서 편집 — 모든 일차가 함께 들어가고, 다른 일차로도 옮길 수 있다
  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragController = useMobilePlanDragController({ roomId, editing, scrollRef });

  function finishEditing() {
    // 순서는 옮길 때마다 저장되므로 여기서는 편집 모드만 끝낸다
    setEditing(false);
    toast.success("변경사항이 저장되었습니다.");
  }

  const { mutateAsync: createSchedule, isPending: isCreatingDay } = useCreateRoomSchedule();
  const { mutateAsync: createItem } = useCreateScheduleItem();

  async function insertDayAfter(dayIndex: number) {
    try {
      const created = await createSchedule({
        roomId,
        body: { dayNumber: dayNumberForInsertAfterDayIndex(dayIndex) },
      });
      setFilter(created.scheduleId);
      toast.success("일차를 추가했어요.");
    } catch (e) {
      toast.error(e instanceof Error && e.message.trim() ? e.message : "일차를 추가하지 못했어요.");
    }
  }

  // ─── 장소 추가: 지도와 같은 전체 화면 검색을 재사용 ─────────────────────
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResetKey, setSearchResetKey] = useState(0);
  /** anchor: 장소 사이에 넣을 기준, null이면 맨 뒤 */
  const addTargetRef = useRef<{ scheduleId: number; anchor: InsertAnchor | null } | null>(null);
  // 방금 추가한 장소 — 해당 카드로 스크롤하고 잠깐 강조한다
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

  function showAddedPlace(itemId: number) {
    window.clearTimeout(highlightTimerRef.current);
    setRecentlyAddedItemId(itemId);
    highlightTimerRef.current = window.setTimeout(
      () => setRecentlyAddedItemId(null),
      ADDED_HIGHLIGHT_MS,
    );
  }

  function openAddPlace(scheduleId: number, anchor: InsertAnchor | null) {
    addTargetRef.current = { scheduleId, anchor };
    // 검색 화면을 먼저 그린 뒤 같은 탭 안에서 focus해야 iOS에서도 키보드가 뜬다
    flushSync(() => setSearchOpen(true));
    searchInputRef.current?.focus();
  }

  function closeAddPlace() {
    setSearchOpen(false);
    setSearchResetKey((k) => k + 1);
  }

  async function handleSelectPlace(entry: MapSearchPlaceEntry): Promise<MapSearchPlaceEntry | null> {
    const target = addTargetRef.current;
    if (!target) return null;
    // 검색하는 동안 다른 사람이 일정을 바꿨을 수 있어 고른 시점의 최신 목록으로 위치를 정한다
    const latest =
      queryClient.getQueryData<PlanPlace[]>(
        scheduleItemsQueryKey(roomId.trim() || null, target.scheduleId),
      ) ?? [];
    const insertIndex = resolveInsertIndex(latest, target.anchor);
    try {
      const created = await createItem({
        roomId,
        scheduleId: target.scheduleId,
        googlePlaceId: entry.googlePlaceId,
        insertIndex,
        placesSnapshot: latest,
      });
      trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
        room_id: roomId,
        item_count_bucket: bucketItemCount(latest.length + 1),
        interaction_source: "search",
      });
      toast.success("일정에 추가했어요.");
      showAddedPlace(created.itemId);
      closeAddPlace();
      return entry;
    } catch {
      toast.error("장소를 일정에 추가하지 못했어요.");
      return null;
    }
  }

  const tabs: { key: MobilePlanDayFilter; label: string }[] = [
    { key: "all", label: "전체" },
    ...schedules.map((s, i) => ({ key: s.scheduleId, label: `Day ${i + 1}` })),
  ];

  let scheduleContent: ReactNode;
  if (isLoading) {
    scheduleContent = <PlanLoadingSkeleton />;
  } else if (isError) {
    scheduleContent = (
      <p className="px-4 py-6 text-center text-body-s-regular text-status-negative">
        일정 목록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.
      </p>
    );
  } else if (schedules.length === 0) {
    scheduleContent = (
      <p className="px-4 py-6 text-center text-body-s-regular text-text-subtle">
        {planCopy.scheduleEmpty}
      </p>
    );
  } else {
    scheduleContent = visibleSchedules.map((schedule) => {
      const dayIndex = schedules.indexOf(schedule);
      return (
        <MobilePlanDaySection
          key={schedule.scheduleId}
          roomId={roomId}
          scheduleId={schedule.scheduleId}
          dayLabel={`${dayIndex + 1}일차`}
          dateLabel={formatMobileDayDate(schedule.date)}
          monthDayLabel={formatMonthDayKo(schedule.date)}
          menuDisabled={menuDisabled || isCreatingDay}
          editing={editing}
          onStartEditing={() => setEditing(true)}
          onFinishEditing={finishEditing}
          onRequestInsertDayAfter={() => void insertDayAfter(dayIndex)}
          onRequestDeleteDay={() => onRequestDeleteDay(dayIndex)}
          onRequestAddPlace={openAddPlace}
          recentlyAddedItemId={recentlyAddedItemId}
          onPlaceAdded={showAddedPlace}
        />
      );
    });
  }

  return (
    <MobilePlanDragProvider value={dragController}>
      <div className="flex min-h-0 flex-1 flex-col bg-fill">
        <nav
          aria-label="일차 선택"
          className="flex shrink-0 gap-2.5 overflow-x-auto bg-fill-subtle p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(({ key, label }) => {
            const active = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className={cn(
                  "shrink-0 rounded-[30px] border border-border bg-fill-subtle px-3.5 py-1.5 text-label-m-emphasis",
                  active ? "text-primary" : "text-text-disabled",
                )}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {scheduleContent}
        </div>

        <MobilePlaceSearchScreen
          open={searchOpen}
          onClose={closeAddPlace}
          inputRef={searchInputRef}
          backLabel="일정으로 돌아가기"
          onSelectPlace={handleSelectPlace}
          resetKey={searchResetKey}
        />
      </div>
    </MobilePlanDragProvider>
  );
}
