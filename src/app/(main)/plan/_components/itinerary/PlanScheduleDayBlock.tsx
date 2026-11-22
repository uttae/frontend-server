"use client";

import { CoinIcon } from "@/assets/icons";
import { ExpenseEntryButton, useExpenseContext } from "@/components/expenses/ExpenseProvider";

import type { CSSProperties, Ref } from "react";

import { usePlanItemDrag } from "@/hooks/usePlanItemDragController";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";

import { PlanDaySection, type PlanDaySectionDragHandleProps } from "./PlanDaySection";
import { PlanItinerary } from "./PlanItinerary";

type PlanScheduleDayBlockProps = {
  roomId: string;
  scheduleId: number;
  title: string;
  subtitle?: string;
  dateHeading?: string;
  onRequestDeleteSchedule?: () => void;
  onRequestInsertScheduleAfter?: () => void;
  isScheduleMenuDisabled?: boolean;
  sectionRef?: Ref<HTMLElement>;
  sectionStyle?: CSSProperties;
  dragHandleProps?: PlanDaySectionDragHandleProps;
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
}: PlanScheduleDayBlockProps) {
  const expenses = useExpenseContext();
  const { data: placesData } = useSchedulePlanPlaces(roomId, scheduleId);
  const crossDayDrop = usePlanItemDrag().getSectionDrop(scheduleId, placesData);

  return (
    <PlanDaySection
      title={title}
      subtitle={dateHeading ?? subtitle}
      itineraryScheduleId={scheduleId}
      summaryAction={
        expenses.canManage ? (
          <ExpenseEntryButton
            scheduleId={scheduleId}
            scopeLabel={title}
            scopeSubtitle={subtitle}
            className="-m-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md p-1 text-body-s-emphasis text-primary transition-colors enabled:hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-primary"
            icon={<CoinIcon size={18} className="shrink-0" />}
          />
        ) : undefined
      }
      onRequestAddExpense={expenses.canManage ? () => expenses.open({ scheduleId }) : undefined}
      isAddExpenseDisabled={expenses.busy}
      onRequestDeleteSchedule={onRequestDeleteSchedule}
      onRequestInsertScheduleAfter={onRequestInsertScheduleAfter}
      isScheduleMenuDisabled={isScheduleMenuDisabled}
      sectionRef={sectionRef}
      sectionStyle={sectionStyle}
      dragHandleProps={dragHandleProps}
      crossDayDrop={crossDayDrop}
    >
      <PlanItinerary roomId={roomId} scheduleId={scheduleId} />
    </PlanDaySection>
  );
}
