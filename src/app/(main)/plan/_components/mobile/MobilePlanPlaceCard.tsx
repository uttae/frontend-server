"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  ChevronDownIcon,
  CoinIcon,
  MenuDotVerticalIcon,
  MenuHamburgerIcon,
  TimeClockIcon,
  WriteIcon,
} from "@/assets/icons";
import { formatScheduleTimeRange } from "@/lib/plan/scheduleTime";
import type { PlanPlace } from "@/lib/plan/types";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { cn } from "@/lib/utils";

type MobilePlanPlaceCardProps = Readonly<{
  place: PlanPlace;
  orderNumber: number;
  /** 지도 핀과 같은 일차 색 */
  badgeColor: string;
  /** 방금 추가된 카드 — 잠깐 강조한다 */
  highlighted?: boolean;
  /** `45,000 KRW 외 1건` — 없으면 비용 줄을 숨긴다 */
  expenseSummary: string | null;
  onOpen: () => void;
  onOpenActions: () => void;
  onOpenExpenses: () => void;
  /** 메모 줄의 연필 아이콘 — 메모 수정 시트를 연다 */
  onEditMemo: () => void;
  /** 시간 줄 — 방문 시간 시트를 연다 */
  onEditTime: () => void;
  /** 순서 편집 모드 — 오른쪽에 이동 핸들을 붙인다 */
  editing: boolean;
  dragDisabled?: boolean;
  onHandlePointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}>;

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

/** 모바일 일정 장소 카드 — 시간·비용·메모 줄은 값이 있을 때만 보인다 */
export function MobilePlanPlaceCard({
  place,
  orderNumber,
  badgeColor,
  highlighted = false,
  expenseSummary,
  onOpen,
  onOpenActions,
  onOpenExpenses,
  onEditMemo,
  onEditTime,
  editing,
  dragDisabled = false,
  onHandlePointerDown,
}: MobilePlanPlaceCardProps) {
  const [memoExpanded, setMemoExpanded] = useState(false);
  const timeRange = formatScheduleTimeRange(place.startTime ?? "", place.endTime);
  const memo = place.memo?.trim() ?? "";
  const meta = [place.primaryTypeDisplayName, place.subtitle].filter(Boolean).join(" · ");

  return (
    <div className="flex items-stretch gap-2">
      <article
        className={cn(
          "relative min-w-0 flex-1 rounded-md border text-left transition-colors duration-500",
          // primary-subtle은 카드 배경으로 너무 진해 빈 일차 드롭존과 같은 원시 토큰을 쓴다
          highlighted ? "border-primary bg-[var(--blue-50)]" : "border-border-subtle bg-fill-subtle",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${orderNumber}번째 장소 ${place.title} 지도에서 보기`}
          className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary-strong"
        />
        <div className="pointer-events-none relative flex gap-3 pb-4 pl-3.5 pr-2 pt-3">
          <span
            aria-hidden
            className="mt-px flex size-6 shrink-0 items-center justify-center rounded-[5.5px] text-body-s-emphasis text-text-inverse"
            style={{ backgroundColor: badgeColor }}
          >
            {orderNumber}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words text-title-s text-text">{place.title}</h3>
            {meta ? <p className="truncate text-body-s-regular text-text-subtle">{meta}</p> : null}
            {timeRange || expenseSummary ? (
              <div className="mt-3.5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
                {timeRange ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      onEditTime();
                    }}
                    aria-label={`${place.title} 방문 시간 수정`}
                    className="pointer-events-auto flex items-center gap-1 text-body-s-regular tabular-nums text-text-subtle"
                  >
                    <TimeClockIcon size={18} className="text-icon-subtle" />
                    {timeRange}
                  </button>
                ) : null}
                {expenseSummary ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      onOpenExpenses();
                    }}
                    aria-label={`${place.title} 비용 보기`}
                    className="pointer-events-auto flex min-w-0 items-center gap-1 text-body-s-regular tabular-nums text-text-subtle"
                  >
                    <CoinIcon size={18} className="text-icon-subtle" />
                    <span className="truncate">{expenseSummary}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onOpenActions();
            }}
            aria-label={`${place.title} 일정 편집`}
            className="pointer-events-auto -mt-1 flex size-8 shrink-0 items-center justify-center"
          >
            <MenuDotVerticalIcon size={20} className="text-icon-subtle" />
          </button>
        </div>

        {memo ? (
          <div className="pointer-events-none relative mx-3.5 flex items-start gap-3.5 border-t border-border-subtle py-3">
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onEditMemo();
              }}
              aria-label={`${place.title} 메모 수정`}
              className="pointer-events-auto -m-1 shrink-0 p-1"
            >
              <WriteIcon size={20} className="text-icon-subtle" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setMemoExpanded((v) => !v);
              }}
              aria-expanded={memoExpanded}
              aria-label={memoExpanded ? "메모 접기" : "메모 펼치기"}
              className="pointer-events-auto flex min-w-0 flex-1 items-start gap-3.5 text-left"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 text-caption-l-regular leading-5 text-text-subtle",
                  memoExpanded ? "whitespace-pre-wrap break-words" : "truncate",
                )}
              >
                {memoExpanded
                  ? renderTextWithLinks(memo, {
                      linkClassName: "break-all text-primary-strong underline underline-offset-2",
                      onLinkClick: stop,
                    })
                  : memo}
              </span>
              <ChevronDownIcon
                size={20}
                className={cn(
                  "shrink-0 text-icon-subtle transition-transform",
                  memoExpanded && "rotate-180",
                )}
              />
            </button>
          </div>
        ) : null}
      </article>

      {editing ? (
        <button
          type="button"
          aria-label={`${place.title} 순서 변경`}
          disabled={dragDisabled}
          onPointerDown={onHandlePointerDown}
          className="flex w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center text-icon-subtle active:cursor-grabbing disabled:opacity-40"
        >
          <MenuHamburgerIcon />
        </button>
      ) : null}
    </div>
  );
}
