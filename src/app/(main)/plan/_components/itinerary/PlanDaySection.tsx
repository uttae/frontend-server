"use client";

import {
  ChevronDownIcon,
  MenuDotHorizontalIcon,
  PlusIcon,
  SectionGrapIcon,
  TrashIcon,
} from "@/assets/icons";
import { ExpenseIcon } from "@/components/icons/ExpenseIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { usePlanItineraryExpandedStore } from "@/stores/plan-itinerary-expanded-store";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { cn } from "@/lib/utils";
import { useCallback, useId, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode, Ref, SyntheticEvent } from "react";

export type PlanDaySectionDragHandleProps = {
  dragDisabled?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: DragEvent<Element>) => void;
  onDragEnd?: () => void;
};

export type PlanDaySectionProps = {
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  itineraryScheduleId?: number | null;
  children?: ReactNode;
  summaryAction?: ReactNode;
  onRequestAddExpense?: () => void;
  isAddExpenseDisabled?: boolean;
  onRequestDeleteSchedule?: () => void;
  onRequestInsertScheduleAfter?: () => void;
  isDeleteScheduleDisabled?: boolean;
  isScheduleMenuDisabled?: boolean;
  sectionRef?: Ref<HTMLElement>;
  sectionStyle?: CSSProperties;
  dragHandleProps?: PlanDaySectionDragHandleProps;
  crossDayDrop?: {
    props?: {
      onDragOver: (e: DragEvent<Element>) => void;
      onDragLeave: (e: DragEvent<Element>) => void;
      onDrop: (e: DragEvent<Element>) => void;
    };
    isTarget: boolean;
  };
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();
export const menuPointerBoundary = {
  onClick: stopPropagation,
  onMouseDown: stopPropagation,
  onPointerDown: stopPropagation,
  onTouchStart: stopPropagation,
};

export function PlanDaySection({
  title,
  subtitle,
  defaultExpanded = true,
  itineraryScheduleId,
  children,
  summaryAction,
  onRequestAddExpense,
  isAddExpenseDisabled = false,
  onRequestDeleteSchedule,
  onRequestInsertScheduleAfter,
  isDeleteScheduleDisabled = false,
  isScheduleMenuDisabled = false,
  sectionRef,
  sectionStyle,
  dragHandleProps,
  crossDayDrop,
}: PlanDaySectionProps) {
  const panelId = useId();

  const trackedSid =
    typeof itineraryScheduleId === "number" &&
    Number.isFinite(itineraryScheduleId)
      ? itineraryScheduleId
      : undefined;

  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  const hasKeyInStore = usePlanItineraryExpandedStore(
    (s) =>
      trackedSid !== undefined &&
      Object.prototype.hasOwnProperty.call(s.expandedByScheduleId, trackedSid),
  );

  const storedExpanded = usePlanItineraryExpandedStore((s) =>
    trackedSid !== undefined
      ? Boolean(s.expandedByScheduleId[trackedSid])
      : false,
  );

  const expanded =
    trackedSid === undefined
      ? localExpanded
      : !hasKeyInStore
        ? defaultExpanded
        : storedExpanded;

  const setScheduleExpanded = usePlanItineraryExpandedStore(
    (s) => s.setScheduleExpanded,
  );

  const routeVisible = usePlanScheduleRouteVisibilityStore((s) =>
    trackedSid !== undefined ? (s.visibleByScheduleId[trackedSid] ?? true) : false,
  );
  const setRouteVisible = usePlanScheduleRouteVisibilityStore(
    (s) => s.setRouteVisible,
  );

  const toggle = useCallback(() => {
    if (trackedSid !== undefined) {
      setScheduleExpanded(trackedSid, !expanded);
    } else {
      setLocalExpanded((v) => !v);
    }
  }, [trackedSid, expanded, setScheduleExpanded]);

  const dragDisabled = dragHandleProps?.dragDisabled ?? true;
  const isDragging = dragHandleProps?.isDragging ?? false;

  const showScheduleMenu =
    onRequestAddExpense != null || onRequestDeleteSchedule != null || onRequestInsertScheduleAfter != null;

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      ref={sectionRef}
      style={sectionStyle}
      {...crossDayDrop?.props}
      className={cn(
        "flex flex-col gap-4 rounded-[12px] bg-fill px-4 pb-4",
        isDragging && "ring-4 ring-inset ring-primary/45",
        crossDayDrop?.isTarget && "ring-3 ring-inset ring-primary/50",
      )}
      aria-label={subtitle ? `${title} ${subtitle}` : title}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-1 py-5">
          {dragHandleProps ? (
            <div
              role="button"
              tabIndex={dragDisabled ? -1 : 0}
              aria-label="일차 순서 변경"
              draggable={!dragDisabled}
              onDragStart={
                dragDisabled ? undefined : dragHandleProps.onDragStart
              }
              onDragEnd={dragDisabled ? undefined : dragHandleProps.onDragEnd}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (dragDisabled) return;
                if (e.key === " " || e.key === "Enter") e.preventDefault();
              }}
              className={cn(
                "-m-1 flex shrink-0 touch-none select-none rounded-md p-1 text-icon",
                dragDisabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-grab active:cursor-grabbing hover:bg-fill-strong",
              )}
            >
              <SectionGrapIcon size={20} />
            </div>
          ) : null}
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={expanded}
            aria-controls={`${panelId}-panel`}
            onClick={toggle}
            className="-m-1 flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md p-1 text-left transition-colors hover:bg-fill-strong"
          >
            <span className="flex min-w-0 items-center gap-2">
              <h2 className="shrink-0 text-title-l text-text">{title}</h2>
              {subtitle ? (
                <span className="min-w-0 truncate text-label-l-emphasis text-text-subtle">
                  {subtitle}
                </span>
              ) : null}
            </span>
            <ChevronDownIcon
              size={20}
              className={cn(
                "text-icon transition-transform motion-reduce:transition-none",
                !expanded && "-rotate-90",
              )}
            />
          </button>
          {showScheduleMenu ? (
            <DropdownMenu open={menuOpen && !isScheduleMenuDisabled} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger
                {...menuPointerBoundary}
                aria-label="일차 메뉴"
                disabled={isScheduleMenuDisabled}
                className={cn(
                  "-m-1 shrink-0 rounded-md p-1 text-icon transition-colors",
                  isScheduleMenuDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-fill-strong",
                )}
              >
                <MenuDotHorizontalIcon size={20} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" {...menuPointerBoundary}>
                {onRequestAddExpense ? (
                  <DropdownMenuItem disabled={isAddExpenseDisabled} onClick={onRequestAddExpense}>
                    <ExpenseIcon />
                    {title} 비용 추가
                  </DropdownMenuItem>
                ) : null}
                {onRequestInsertScheduleAfter ? (
                  <DropdownMenuItem onClick={onRequestInsertScheduleAfter}>
                    <PlusIcon />
                    일차 추가
                  </DropdownMenuItem>
                ) : null}
                {onRequestDeleteSchedule ? (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isDeleteScheduleDisabled}
                    onClick={onRequestDeleteSchedule}
                  >
                    <TrashIcon />
                    일차 삭제
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {summaryAction || trackedSid !== undefined ? (
          <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="min-w-0 flex-1">{summaryAction}</div>
            {trackedSid !== undefined ? (
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-label-m-regular text-text-subtle select-none">
                경로 보기
                <Switch
                  size="sm"
                  checked={routeVisible}
                  onCheckedChange={(checked) => setRouteVisible(trackedSid, checked)}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        id={`${panelId}-panel`}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        hidden={!expanded}
      >
        {children}
      </div>
    </section>
  );
}
