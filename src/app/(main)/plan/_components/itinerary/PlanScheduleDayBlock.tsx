"use client";

import { ExpenseEntryButton, useExpenseContext } from "@/components/expenses/ExpenseProvider";
import { ExpenseIcon } from "@/components/icons/ExpenseIcon";

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
  subtitle?: string;
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
      subtitle={subtitle}
      itineraryScheduleId={scheduleId}
      footerAction={expenses.canManage ? (
        <ExpenseEntryButton
          scheduleId={scheduleId}
          scopeLabel={title}
          scopeSubtitle={subtitle}
          className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold text-primary-strong transition-colors enabled:hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
          icon={<ExpenseIcon className="size-4 shrink-0" />}
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
