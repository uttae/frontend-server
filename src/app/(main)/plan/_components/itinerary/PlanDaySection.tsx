"use client";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { usePlanItineraryExpandedStore } from "@/stores/plan-itinerary-expanded-store";
import { usePlanScheduleRouteVisibilityStore } from "@/stores/plan-schedule-route-visibility-store";
import { usePlanItemCrossDayDragStore } from "@/stores/plan-item-cross-day-drag-store";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreHorizontal,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode, Ref } from "react";

export type PlanDaySectionDragHandleProps = {
  dragDisabled?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: DragEvent<Element>) => void;
  onDragEnd?: () => void;
};

export type PlanDaySectionProps = {
  title: string;
  subtitle?: string;
  /** 접힌 상태로 마운트할지 (기본: 펼침) — 일정 스케줄 ID 동기화 시에는 `PlanPageView` 기본값과 같이 동작함 */
  defaultExpanded?: boolean;
  /**
   * 플랜 우측 맵 오버레이와 동일한 펼침 상태(`usePlanItineraryExpandedStore`)를 공유함.
   * 생략 시 로컬 `useState`만 사용합니다.
   */
  itineraryScheduleId?: number | null;
  children?: ReactNode;
  /**
   * 일차(schedule) 단위 삭제 — schedule-item(장소) 삭제와 구분됩니다.
   * 지정 시 헤더 우측에 더보기 메뉴가 표시됩니다.
   */
  onRequestDeleteSchedule?: () => void;
  /** 해당 일차 바로 뒤에 빈 일차 삽입 */
  onRequestInsertScheduleAfter?: () => void;
  /** 일차가 1개뿐일 때 등 삭제 불가 — 메뉴 항목은 보이되 비활성화 */
  isDeleteScheduleDisabled?: boolean;
  /** mutation·drag 중 메뉴 비활성화 */
  isScheduleMenuDisabled?: boolean;
  sectionRef?: Ref<HTMLElement>;
  sectionStyle?: CSSProperties;
  dragHandleProps?: PlanDaySectionDragHandleProps;
  /** item cross-day D&D — 헤더·접힌 일차 drop (PlanItinerary list와 병행) */
  crossDaySectionDropProps?: {
    onDragOver: (e: DragEvent<Element>) => void;
    onDragLeave: (e: DragEvent<Element>) => void;
    onDrop: (e: DragEvent<Element>) => void;
  };
};

export function PlanDaySection({
  title,
  subtitle,
  defaultExpanded = true,
  itineraryScheduleId,
  children,
  onRequestDeleteSchedule,
  onRequestInsertScheduleAfter,
  isDeleteScheduleDisabled = false,
  isScheduleMenuDisabled = false,
  sectionRef,
  sectionStyle,
  dragHandleProps,
  crossDaySectionDropProps,
}: PlanDaySectionProps) {
  const panelId = useId();

  const trackedSid =
    typeof itineraryScheduleId === "number" &&
    Number.isFinite(itineraryScheduleId)
      ? itineraryScheduleId
      : undefined;

  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  /** 객체를 반환하면 매번 새 참조 → useSyncExternalStore 무한 렌더 — 불리언만 선택 */
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
  const toggleRouteVisible = useCallback(() => {
    if (trackedSid === undefined) return;
    setRouteVisible(trackedSid, !routeVisible);
  }, [trackedSid, routeVisible, setRouteVisible]);

  const toggle = useCallback(() => {
    if (trackedSid !== undefined) {
      setScheduleExpanded(trackedSid, !expanded);
    } else {
      setLocalExpanded((v) => !v);
    }
  }, [trackedSid, expanded, setScheduleExpanded]);

  const dragDisabled = dragHandleProps?.dragDisabled ?? true;
  const isDragging = dragHandleProps?.isDragging ?? false;

  const sourceScheduleId = usePlanItemCrossDayDragStore(
    (s) => s.sourceScheduleId,
  );
  const hoverTargetScheduleId = usePlanItemCrossDayDragStore(
    (s) => s.hoverTargetScheduleId,
  );
  const isCrossDayItemDropTarget =
    trackedSid !== undefined &&
    sourceScheduleId !== null &&
    sourceScheduleId !== trackedSid &&
    hoverTargetScheduleId === trackedSid;

  const isHighlighted = isDragging || isCrossDayItemDropTarget;

  const showScheduleMenu =
    onRequestDeleteSchedule != null || onRequestInsertScheduleAfter != null;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setMenuOpen(false));

  return (
    <section
      ref={sectionRef}
      style={sectionStyle}
      {...crossDaySectionDropProps}
      className={cn(
        "rounded-2xl border border-gray-border bg-white",
        isDragging && "border-primary/80 ring-4 ring-inset ring-primary/45",
        isCrossDayItemDropTarget &&
          "border-primary ring-3 ring-inset ring-primary/50",
      )}
      aria-label={subtitle ? `${title} ${subtitle}` : title}
    >
      <div className="overflow-visible rounded-2xl">
        <div
          className={cn(
            "relative flex w-full items-stretch gap-0.5 py-3.5",
            MAIN_CARD_INNER_PADDING_X_CLASS,
            expanded ? "rounded-t-2xl" : "rounded-2xl",
          )}
        >
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
                "flex shrink-0 touch-none select-none self-center rounded-lg p-1.5 text-dark-gray",
                dragDisabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-grab active:cursor-grabbing hover:bg-bubble-gray/60",
              )}
            >
              <GripVertical className="h-5 w-5" aria-hidden />
            </div>
          ) : null}
          <button
            type="button"
            id={`${panelId}-trigger`}
            aria-expanded={expanded}
            aria-controls={`${panelId}-panel`}
            onClick={toggle}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-left transition-colors hover:bg-bubble-gray/60"
          >
            <span className="shrink-0 text-dark-gray" aria-hidden>
              {expanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate text-[19px] font-semibold text-gray-900">
                  {subtitle || title}
                </h2>
                {subtitle ? (
                  <span className="inline-flex shrink-0 items-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                    {title}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
          {trackedSid !== undefined ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleRouteVisible();
              }}
              aria-pressed={routeVisible}
              aria-label={
                routeVisible ? "지도에서 경로 숨기기" : "지도에 경로 표시"
              }
              title={routeVisible ? "지도에서 경로 숨기기" : "지도에 경로 표시"}
              className={cn(
                "shrink-0 cursor-pointer self-center rounded-lg p-2 transition-colors mobile:hidden",
                routeVisible
                  ? "text-primary hover:bg-primary/10"
                  : "text-dark-gray hover:bg-bubble-gray/60",
              )}
            >
              <Route className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          {showScheduleMenu ? (
            <div ref={menuRef} className="relative shrink-0 self-center">
              <button
                type="button"
                aria-label="일차 메뉴"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                disabled={isScheduleMenuDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isScheduleMenuDisabled) return;
                  setMenuOpen((v) => !v);
                }}
                className={cn(
                  "rounded-lg p-2 text-dark-gray transition-colors",
                  isScheduleMenuDisabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-bubble-gray/60",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </button>
              {menuOpen && !isScheduleMenuDisabled ? (
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-max overflow-hidden rounded-xl border border-gray-border bg-white py-1 shadow-lg"
                  role="menu"
                >
                  {onRequestInsertScheduleAfter ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2.5 text-left text-[17px] text-neutral-900 hover:bg-bubble-gray"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onRequestInsertScheduleAfter();
                      }}
                    >
                      <Plus className="size-4 shrink-0" aria-hidden />
                      일차 추가하기
                    </button>
                  ) : null}
                  {onRequestDeleteSchedule ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={isDeleteScheduleDisabled}
                      className={cn(
                        "flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-left text-[17px] text-status-negative hover:bg-bubble-gray",
                        isDeleteScheduleDisabled
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        if (isDeleteScheduleDisabled) return;
                        onRequestDeleteSchedule();
                      }}
                    >
                      <Trash2 className="size-4 shrink-0" aria-hidden />
                      일차 삭제하기
                    </button>
                  ) : null}
                </div>
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
          <div
            className={cn(
              cn(MAIN_CARD_INNER_PADDING_X_CLASS, "pb-4"),
              expanded
                ? "border-t border-dashed border-gray-border pt-3"
                : "pt-1",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
