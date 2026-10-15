"use client";

import { CoinIcon } from "@/assets/icons";
import { ExpenseEntryButton, useExpenseContext } from "@/components/expenses/ExpenseProvider";

import type { CSSProperties, Ref } from "react";

import { usePlanDaySectionCrossDayDrop } from "@/hooks/usePlanDaySectionCrossDayDrop";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";

import {
  PlanDaySection,
  type PlanDaySectionDragHandleProps,
} from "./PlanDaySection";
import { PlanItinerary } from "./PlanItinerary";

type PlanScheduleDayBlockProps = {
  roomId: string;
  scheduleId: number;
  title: string;
  /** 가계부 패널 부제목에 쓰는 날짜 — `10월 12일 (월)` */
  subtitle?: string;
  /** 일차 헤더에 보이는 날짜 — `10.12(월)` */
  dateHeading?: string;
  onRequestDeleteSchedule?: () => void;
  onRequestInsertScheduleAfter?: () => void;
  isScheduleMenuDisabled?: boolean;
  sectionRef?: Ref<HTMLElement>;
  sectionStyle?: CSSProperties;
  dragHandleProps?: PlanDaySectionDragHandleProps;
  interactionLocked?: boolean;
};

export function PlanScheduleDayBlock({
  roomId,
  scheduleId,
  title,
  subtitle,
  dateHeading,
  onRequestDeleteSchedule,
  onRequestInsertScheduleAfter,
  isScheduleMenuDisabled = false,
  sectionRef,
  sectionStyle,
  dragHandleProps,
  interactionLocked = false,
}: PlanScheduleDayBlockProps) {
  const expenses = useExpenseContext();
  const { data: placesData } = useSchedulePlanPlaces(roomId, scheduleId);
  const placesCount = placesData?.length ?? 0;

  const { crossDaySectionDropProps } = usePlanDaySectionCrossDayDrop({
    roomId,
    scheduleId,
    placesCount,
    interactionLocked,
  });

  return (
    <PlanDaySection
      title={title}
      subtitle={dateHeading ?? subtitle}
      itineraryScheduleId={scheduleId}
      summaryAction={expenses.canManage ? (
        <ExpenseEntryButton
          scheduleId={scheduleId}
          scopeLabel={title}
          scopeSubtitle={subtitle}
          className="inline-flex min-h-8 max-w-full cursor-pointer items-center gap-1 rounded-lg py-1 pl-[3px] pr-1 text-body-s-emphasis text-primary transition-colors enabled:hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
          icon={<CoinIcon size={16} />}
        />
      ) : undefined}
      onRequestAddExpense={expenses.canManage ? () => expenses.open({ scheduleId }) : undefined}
      isAddExpenseDisabled={expenses.busy}
      onRequestDeleteSchedule={onRequestDeleteSchedule}
      onRequestInsertScheduleAfter={onRequestInsertScheduleAfter}
      isScheduleMenuDisabled={isScheduleMenuDisabled}
      sectionRef={sectionRef}
      sectionStyle={sectionStyle}
      dragHandleProps={dragHandleProps}
      crossDaySectionDropProps={crossDaySectionDropProps}
    >
      <PlanItinerary roomId={roomId} scheduleId={scheduleId} />
    </PlanDaySection>
  );
}
