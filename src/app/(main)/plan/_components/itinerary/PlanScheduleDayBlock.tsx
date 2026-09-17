"use client";

import { ExpenseEntryButton } from "@/components/expenses/ExpenseProvider";

import type { CSSProperties, Ref } from "react";

import { usePlanDaySectionCrossDayDrop } from "@/hooks/usePlanDaySectionCrossDayDrop";
import { useSchedulePlanPlaces } from "@/hooks/useRooms";
import { usePlanMobileReadOnly } from "@/hooks/usePlanMobileReadOnly";

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
  const { isReadOnly } = usePlanMobileReadOnly();
  const { data: placesData } = useSchedulePlanPlaces(roomId, scheduleId);
  const placesCount = placesData?.length ?? 0;

  const { crossDaySectionDropProps } = usePlanDaySectionCrossDayDrop({
    roomId,
    scheduleId,
    placesCount,
    interactionLocked: interactionLocked || isReadOnly,
  });

  return (
    <PlanDaySection
      title={title}
      subtitle={subtitle}
      itineraryScheduleId={scheduleId}
      onRequestDeleteSchedule={onRequestDeleteSchedule}
      onRequestInsertScheduleAfter={onRequestInsertScheduleAfter}
      isScheduleMenuDisabled={isScheduleMenuDisabled}
      sectionRef={sectionRef}
      sectionStyle={sectionStyle}
      dragHandleProps={dragHandleProps}
      crossDaySectionDropProps={crossDaySectionDropProps}
    >
      <div className="mb-2 flex justify-end">
        <ExpenseEntryButton scheduleId={scheduleId} label={`${title} 지출 추가`} />
      </div>
      <PlanItinerary roomId={roomId} scheduleId={scheduleId} />
    </PlanDaySection>
  );
}
