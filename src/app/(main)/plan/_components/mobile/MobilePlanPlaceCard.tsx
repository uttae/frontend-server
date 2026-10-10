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
  /** 카드 본문 — 없으면 본문을 눌러도 아무 일도 없다(예: 경로 보기에서 펼친 카드) */
  onOpen?: () => void;
  /** 본문 버튼의 접근성 이름 끝말 — 기본 "경로 보기" */
  openLabel?: string;
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
  /** 바깥 줄 — 예: 경로 보기에서 높이를 채운다 */
  className?: string;
  /** 카드 테두리·배경 — 예: 펼친 경로 카드 안에서는 테두리를 없앤다 */
  articleClassName?: string;
  /**
   * 비어 있는 시간·비용·메모 자리에 흐린 "추가" 줄을 두고, 시간·비용을 늘 한 줄씩 나눠 보인다
   * — 경로 보기처럼 카드 높이를 맞춰 넘겨 볼 때. 누르면 값이 있을 때와 같은 `onEditTime`·`onOpenExpenses`·`onEditMemo`를 부른다.
   * `expense`는 비용 권한이 있을 때만 켠다.
   */
  addWhenEmpty?: { time: boolean; expense: boolean; memo: boolean };
}>;

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

/** 모바일 일정 장소 카드 — 시간·비용·메모 줄은 값이 있을 때만 보인다(`addWhenEmpty`면 빈 줄도 "추가"로 보인다) */
export function MobilePlanPlaceCard({
  place,
  orderNumber,
  badgeColor,
  highlighted = false,
  expenseSummary,
  onOpen,
  openLabel = "경로 보기",
  onOpenActions,
  onOpenExpenses,
  onEditMemo,
  onEditTime,
  editing,
  dragDisabled = false,
  onHandlePointerDown,
  className,
  articleClassName,
  addWhenEmpty,
}: MobilePlanPlaceCardProps) {
  const meta = [place.primaryTypeDisplayName, place.subtitle].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <article
        className={cn(
          "relative min-w-0 flex-1 rounded-md border text-left transition-colors duration-500",
          // primary-subtle은 카드 배경으로 너무 진해 빈 일차 드롭존과 같은 원시 토큰을 쓴다
          highlighted ? "border-primary bg-[var(--blue-50)]" : "border-border-subtle bg-fill-subtle",
          articleClassName,
        )}
      >
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${orderNumber}번째 장소 ${place.title} ${openLabel}`}
            className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary-strong"
          />
        ) : null}
        <div className="pointer-events-none relative flex gap-3 pb-3 pl-3.5 pr-2 pt-3">
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
            <PlaceTimeAndExpense place={place} expenseSummary={expenseSummary}
              addWhenEmpty={addWhenEmpty} onEditTime={onEditTime} onOpenExpenses={onOpenExpenses} />
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

        <PlaceMemo place={place} addWhenEmpty={addWhenEmpty} onEditMemo={onEditMemo} />
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

function PlaceTimeAndExpense({ place, expenseSummary, addWhenEmpty, onEditTime, onOpenExpenses }:
  Pick<MobilePlanPlaceCardProps, "place" | "expenseSummary" | "addWhenEmpty" | "onEditTime" | "onOpenExpenses">) {
  const timeRange = formatScheduleTimeRange(place.startTime ?? "", place.endTime);
  const addTime = !timeRange && Boolean(addWhenEmpty?.time);
  const addExpense = !expenseSummary && Boolean(addWhenEmpty?.expense);
  return <>
            {timeRange || expenseSummary || addTime || addExpense ? (
              <div
                className={cn(
                  "mt-2 flex min-w-0 gap-y-1",
                  addWhenEmpty ? "flex-col items-start" : "flex-wrap items-center gap-x-5",
                )}
              >
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
                {!timeRange && addTime ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      onEditTime();
                    }}
                    aria-label={`${place.title} 방문 시간 추가`}
                    className="pointer-events-auto flex items-center gap-1 text-body-s-regular text-text-disabled"
                  >
                    <TimeClockIcon size={18} className="text-icon-disabled" />
                    시간 추가
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
                {!expenseSummary && addExpense ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      onOpenExpenses();
                    }}
                    aria-label={`${place.title} 비용 추가`}
                    className="pointer-events-auto flex items-center gap-1 text-body-s-regular text-text-disabled"
                  >
                    <CoinIcon size={18} className="text-icon-disabled" />
                    비용 추가
                  </button>
                ) : null}
              </div>
            ) : null}
  </>;
}

function PlaceMemo({ place, addWhenEmpty, onEditMemo }:
  Pick<MobilePlanPlaceCardProps, "place" | "addWhenEmpty" | "onEditMemo">) {
  const [memoExpanded, setMemoExpanded] = useState(false);
  const memo = place.memo?.trim() ?? "";
  const addMemo = !memo && Boolean(addWhenEmpty?.memo);
  return <>
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
        {!memo && addMemo ? (
          // 메모가 있을 때와 같은 줄(구분선·아이콘·꺾쇠)을 흐리게 — 누르면 메모 시트
          <div className="pointer-events-none relative mx-3.5 border-t border-border-subtle py-3">
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onEditMemo();
              }}
              aria-label={`${place.title} 메모 추가`}
              className="pointer-events-auto flex w-full min-w-0 items-center gap-3.5 text-left"
            >
              <WriteIcon size={20} className="shrink-0 text-icon-disabled" />
              <span className="min-w-0 flex-1 truncate text-caption-l-regular leading-5 text-text-disabled">
                메모를 추가해보세요.
              </span>
              <ChevronDownIcon size={20} className="shrink-0 text-icon-disabled" />
            </button>
          </div>
        ) : null}
  </>;
}
