"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  useCreateRoomSchedule,
  useDeleteRoomSchedule,
  useRoomSchedules,
} from "@/hooks/useRooms";
import { useSessionStore } from "@/stores/session-store";
import { usePlanItineraryExpandedStore } from "@/stores/plan-itinerary-expanded-store";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";

import {
  dayNumberForInsertAfterDayIndex,
  mergeSchedulesWithPlaces,
  sortRoomSchedules,
} from "@/lib/plan/scheduleMerge";
import { cn } from "@/lib/utils";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";

import { usePlanScheduleDayReorder } from "@/hooks/usePlanScheduleDayReorder";
import { planCopy } from "@/lib/plan/planCopy";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import {
  bucketMemberCount,
  toAnalyticsRoomRole,
} from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { PlanContainerRefProvider } from "../plan-container";
import { PlanScheduleDayBlock } from "./PlanScheduleDayBlock";

export function PlanPageView() {
  const planContainerRef = useRef<HTMLDivElement>(null);
  
  //room id 가져와서 room detail, schedules 가져오기
  const storedId = useSessionStore((s) => s.currentRoomId);
  const roomId =
    typeof storedId === "string" && storedId.trim().length > 0
      ? storedId.trim()
      : "";
  const roomIdForQueries = roomId.length > 0 ? roomId : null;

  const { data: roomDetail } = useRoomDetail(roomIdForQueries);
  
  //방에 들어올 때 analytics 이벤트 보내기 (같은방 아니면) => refactoring 필요(ref 제거 가능성)
  const lastTrackedPlanIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!roomDetail || lastTrackedPlanIdRef.current === roomDetail.id) return;
    lastTrackedPlanIdRef.current = roomDetail.id;
    trackAnalyticsEvent(AnalyticsEvents.viewPlan, {
      member_count_bucket: bucketMemberCount(roomDetail.memberCount),
      role: toAnalyticsRoomRole(roomDetail.role),
    });
  }, [roomDetail]);

  //hooks
  const {
    data: schedules,
    isPending,
    isError,
  } = useRoomSchedules(roomIdForQueries);
  const { mutate: deleteSchedule, isPending: isDeletingSchedule } =
    useDeleteRoomSchedule();
  const [dayToDelete, setDayToDelete] = useState<{
    scheduleId: number;
    isLast: boolean;
  } | null>(null);
  const { mutateAsync: createScheduleAsync, isPending: isCreatingSchedule } =
    useCreateRoomSchedule();

  //schedules 정렬, day block 생성 => refactoring 필요
  const scheduleList = useMemo(() => schedules ?? [], [schedules]);
  const sortedSchedules = useMemo(
    () => sortRoomSchedules(scheduleList),
    [scheduleList],
  );

  const { getSectionProps, listContainerProps, isMovePending } =
    usePlanScheduleDayReorder({
      roomId,
      schedules: sortedSchedules,
      interactionLocked: isCreatingSchedule || isDeletingSchedule,
    });

  const scheduleExpansionSyncKey = useMemo(
    () => sortedSchedules.map((s) => s.scheduleId).join(","),
    [sortedSchedules],
  );
  const expansionRoomResetRevision = usePlanItineraryExpandedStore(
    (s) => s.roomResetRevision,
  );

  useLayoutEffect(() => {
    const ids =
      scheduleExpansionSyncKey.length > 0
        ? scheduleExpansionSyncKey
            .split(",")
            .map(Number)
            .filter(Number.isFinite)
        : [];
    usePlanItineraryExpandedStore.getState().syncScheduleExpansionState(ids);
    usePlanScheduleRouteVisibilityStore.getState().syncRouteVisibility(ids);
  }, [scheduleExpansionSyncKey, expansionRoomResetRevision]);

  const planDays = useMemo(
    () =>
      scheduleList.length > 0 ? mergeSchedulesWithPlaces(scheduleList) : [],
    [scheduleList],
  );

  const handleDeleteScheduleDay = useCallback(
    (dayIndex: number) => {
      if (!roomId.length) return;
      if (isDeletingSchedule) return;
      const sid = sortedSchedules[dayIndex]?.scheduleId;
      if (sid == null) return;
      setDayToDelete({ scheduleId: sid, isLast: sortedSchedules.length === 1 });
    },
    [isDeletingSchedule, roomId, sortedSchedules],
  );

  const handleConfirmDeleteScheduleDay = useCallback(() => {
    if (!dayToDelete) return;
    const { isLast } = dayToDelete;
    deleteSchedule(
      { roomId, scheduleId: dayToDelete.scheduleId },
      {
        onSuccess: () => {
          setDayToDelete(null);
          toast.success(isLast ? "일차를 비웠어요." : "일차를 삭제했어요.");
        },
      },
    );
  }, [dayToDelete, deleteSchedule, roomId]);

  const handleInsertScheduleAfter = useCallback(
    (dayIndex: number) => {
      if (!roomId.length) return;
      if (isCreatingSchedule) return;
      const dayNumber = dayNumberForInsertAfterDayIndex(dayIndex);
      void createScheduleAsync({ roomId, body: { dayNumber } }).catch((e) => {
        toast.error(
          e instanceof Error && e.message.trim()
            ? e.message
            : "일차를 추가하지 못했어요.",
        );
      });
    },
    [createScheduleAsync, isCreatingSchedule, roomId],
  );

  const showInitialLoading = Boolean(
    roomId.length > 0 && isPending && schedules === undefined,
  );

  const pageContentClassName =
    "@container/plan space-y-2.5 overflow-x-auto pb-8";

  const pageHeader = <MainPageHeader title="일정" />;

  if (showInitialLoading) {
    return (
      <PlanContainerRefProvider containerRef={planContainerRef}>
        <div
          ref={planContainerRef}
          className={pageContentClassName}
        >
          {pageHeader}
          <p className="py-8 text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
            일정을 불러오는 중…
          </p>
        </div>
      </PlanContainerRefProvider>
    );
  }

  return (
    <PlanContainerRefProvider containerRef={planContainerRef}>
      <div
        ref={planContainerRef}
        className={pageContentClassName}
      >
        {pageHeader}

        {isError ? (
          <p
            className={cn(
              "rounded-xl border border-gray-border bg-white py-3 text-body-m-regular mobile:text-body-s-regular text-primary",
              MAIN_CARD_INNER_PADDING_X_CLASS,
            )}
          >
            일정 목록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.
          </p>
        ) : null}

        {!isError && planDays.length === 0 ? (
          <p
            className={cn(
              "rounded-xl border border-gray-border bg-white py-3 text-body-m-regular mobile:text-body-s-regular text-dark-gray",
              MAIN_CARD_INNER_PADDING_X_CLASS,
            )}
          >
            {planCopy.scheduleEmpty}
          </p>
        ) : null}

        {planDays.length > 0 ? (
          <div className="space-y-2.5" {...listContainerProps}>
            {planDays.map((day, dayIndex) => {
              const sectionProps = getSectionProps(dayIndex);

              return (
                <PlanScheduleDayBlock
                  key={day.id}
                  roomId={roomId}
                  scheduleId={sortedSchedules[dayIndex]!.scheduleId}
                  title={day.dayLabel}
                  subtitle={day.dateLabel}
                  onRequestDeleteSchedule={
                    sortedSchedules[dayIndex]
                      ? () => handleDeleteScheduleDay(dayIndex)
                      : undefined
                  }
                  onRequestInsertScheduleAfter={
                    sortedSchedules[dayIndex]
                      ? () => handleInsertScheduleAfter(dayIndex)
                      : undefined
                  }
                  isScheduleMenuDisabled={
                    isCreatingSchedule || isDeletingSchedule || isMovePending
                  }
                  interactionLocked={isCreatingSchedule || isDeletingSchedule}
                  {...sectionProps}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      {dayToDelete ? (
        <ConfirmDialog
          title={dayToDelete.isLast ? "이 일차를 비울까요?" : "이 일차를 삭제할까요?"}
          description={
            dayToDelete.isLast
              ? "마지막 일차는 남고, 이 일차의 모든 장소와 비용이 삭제돼요."
              : "이 일차에 포함된 모든 장소와 비용도 함께 삭제돼요."
          }
          confirmLabel={dayToDelete.isLast ? "비우기" : "삭제"}
          isPending={isDeletingSchedule}
          onConfirm={handleConfirmDeleteScheduleDay}
          onCancel={() => setDayToDelete(null)}
        />
      ) : null}
    </PlanContainerRefProvider>
  );
}
