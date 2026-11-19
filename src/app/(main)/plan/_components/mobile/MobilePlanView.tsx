"use client";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import { formatMobileDayDate, formatMonthDayKo } from "@/lib/plan/mobilePlanFormat";
import { planCopy } from "@/lib/plan/planCopy";
import { dayNumberForInsertAfterDayIndex } from "@/lib/plan/scheduleMerge";
import { useCreateRoomSchedule } from "@/hooks/useRooms";
import { Chip } from "@/components/ui/chip";
import { useMobilePlanDayFilterStore, type MobilePlanDayFilter } from "@/stores/mobile-plan-day-filter-store";

import { MobilePlanDaySection } from "./MobilePlanDaySection";
import { MobilePlanDragProvider, useMobilePlanDragController } from "./mobilePlanDrag";
import { useMobileAddPlaceSearch } from "./useMobileAddPlaceSearch";

type MobilePlanViewProps = Readonly<{
  roomId: string;
  schedules: RoomSchedule[];
  isLoading: boolean;
  isError: boolean;
  menuDisabled: boolean;
  onRequestDeleteDay: (dayIndex: number) => void;
}>;

export function MobilePlanView({
  roomId,
  schedules,
  isLoading,
  isError,
  menuDisabled,
  onRequestDeleteDay,
}: MobilePlanViewProps) {
  const filter = useMobilePlanDayFilterStore((s) => s.filterByRoomId[roomId] ?? "all");
  const setRoomFilter = useMobilePlanDayFilterStore((s) => s.setFilter);
  const setFilter = (next: MobilePlanDayFilter) => setRoomFilter(roomId, next);
  const activeFilter = filter !== "all" && !schedules.some((s) => s.scheduleId === filter) ? "all" : filter;
  const visibleSchedules = activeFilter === "all" ? schedules : schedules.filter((s) => s.scheduleId === activeFilter);

  const [editing, setEditing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragController = useMobilePlanDragController({ roomId, editing, scrollRef });

  function finishEditing() {
    setEditing(false);
    toast.success("변경사항이 저장되었습니다.");
  }

  const { mutateAsync: createSchedule, isPending: isCreatingDay } = useCreateRoomSchedule();

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

  const addPlace = useMobileAddPlaceSearch({ roomId, backLabel: "일정으로 돌아가기" });

  const tabs: { key: MobilePlanDayFilter; label: string }[] = [
    { key: "all", label: "전체 보기" },
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
      <p className="px-4 py-6 text-center text-body-s-regular text-text-subtle">{planCopy.scheduleEmpty}</p>
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
          onRequestAddPlace={addPlace.open}
          recentlyAddedItemId={addPlace.recentlyAddedItemId}
          onPlaceAdded={addPlace.showAddedPlace}
        />
      );
    });
  }

  return (
    <MobilePlanDragProvider value={dragController}>
      <div className="flex min-h-0 flex-1 flex-col bg-fill">
        <nav
          aria-label="일차 선택"
          className="flex shrink-0 gap-2.5 overflow-x-auto border-b border-border bg-fill-subtle p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(({ key, label }) => (
            <Chip
              key={key}
              variant="outline"
              size="md"
              render={<button type="button" onClick={() => setFilter(key)} aria-pressed={activeFilter === key} />}
            >
              {label}
            </Chip>
          ))}
        </nav>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {scheduleContent}
        </div>

        {addPlace.screen}
      </div>
    </MobilePlanDragProvider>
  );
}
