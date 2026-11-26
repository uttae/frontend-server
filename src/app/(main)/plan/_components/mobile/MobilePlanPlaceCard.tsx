"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  ChevronDownIcon,
  CoinIcon,
  MemoIcon,
  MenuDotHorizontalIcon,
  MenuHamburgerIcon,
  TimeClockIcon,
} from "@/assets/icons";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { formatScheduleTimeRange } from "@/lib/plan/scheduleTime";
import type { PlanPlace } from "@/lib/plan/types";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { cn } from "@/lib/utils";

type MobilePlanPlaceCardProps = Readonly<{
  place: PlanPlace;
  orderNumber: number;
  badgeColor: string;
  highlighted?: boolean;
  expenseSummary: string | null;
  onOpen?: () => void;
  openLabel?: string;
  onOpenActions: () => void;
  onOpenExpenses: () => void;
  onEditMemo: () => void;
  onEditTime: () => void;
  editing: boolean;
  dragDisabled?: boolean;
  onHandlePointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  className?: string;
  articleClassName?: string;
  addWhenEmpty?: { time: boolean; expense: boolean; memo: boolean };
}>;

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

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
          "relative min-w-0 flex-1 rounded-md border px-4 text-left transition-colors duration-500",
          highlighted ? "border-primary bg-[var(--blue-50)]" : "border-border bg-fill-subtle",
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
        <div className="pointer-events-none relative flex items-start gap-2.5 py-4">
          <div className="flex min-w-0 flex-1 gap-2">
            <span
              aria-hidden
              className="mt-px flex size-6 shrink-0 items-center justify-center rounded-[4px] text-body-s-emphasis text-text-inverse"
              style={{ backgroundColor: badgeColor }}
            >
              {orderNumber}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="line-clamp-2 break-words text-title-s text-text">{place.title}</h3>
                {meta ? <PlaceMeta place={place} meta={meta} /> : null}
              </div>
              <PlaceTimeAndExpense
                place={place}
                expenseSummary={expenseSummary}
                addWhenEmpty={addWhenEmpty}
                onEditTime={onEditTime}
                onOpenExpenses={onOpenExpenses}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onOpenActions();
            }}
            aria-label={`${place.title} 일정 편집`}
            className="pointer-events-auto -m-2.5 flex size-10 shrink-0 items-center justify-center"
          >
            <MenuDotHorizontalIcon size={20} className="text-icon-subtle" />
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

function PlaceMeta({ place, meta }: Readonly<{ place: PlanPlace; meta: string }>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [textRef, truncated] = useTruncated<HTMLParagraphElement>(meta);
  const addressId = useId();
  const [open, setOpen] = useState(false);
  useOnClickOutside(wrapRef, () => setOpen(false));

  const expandable = truncated && Boolean(place.subtitle);
  return (
    <div ref={wrapRef} className="relative">
      <p ref={textRef} className="truncate text-body-s-regular text-text-subtle">
        {meta}
      </p>
      {expandable ? (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-controls={addressId}
          aria-label={`${place.title} 전체 주소 ${open ? "닫기" : "보기"}`}
          className="pointer-events-auto absolute inset-0 cursor-pointer"
        />
      ) : null}
      {expandable && open ? (
        <p
          id={addressId}
          className="pointer-events-auto absolute inset-x-0 top-full z-20 mt-1 break-words rounded-[12px] bg-fill-elevate px-3.5 py-3 text-body-s-regular text-text shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
        >
          {place.subtitle}
        </p>
      ) : null}
    </div>
  );
}

function PlaceTimeAndExpense({
  place,
  expenseSummary,
  addWhenEmpty,
  onEditTime,
  onOpenExpenses,
}: Pick<MobilePlanPlaceCardProps, "place" | "expenseSummary" | "addWhenEmpty" | "onEditTime" | "onOpenExpenses">) {
  const summaryId = useId();
  const timeRange = formatScheduleTimeRange(place.startTime ?? "", place.endTime);
  const addTime = !timeRange && Boolean(addWhenEmpty?.time);
  const addExpense = !expenseSummary && Boolean(addWhenEmpty?.expense);
  return (
    <>
      {timeRange || expenseSummary || addTime || addExpense ? (
        <div
          className={cn(
            "flex min-w-0 gap-y-1",
            addWhenEmpty ? "flex-col items-start" : "flex-wrap items-center gap-x-4",
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
              className="pointer-events-auto flex items-center gap-1.5 text-body-s-emphasis tabular-nums text-text"
            >
              <TimeClockIcon size={18} className="text-primary" />
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
              className="pointer-events-auto flex items-center gap-1.5 text-body-s-regular text-text-disabled"
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
              aria-describedby={summaryId}
              className="pointer-events-auto flex min-w-0 max-w-full items-center gap-1.5 text-body-s-emphasis tabular-nums text-text"
            >
              <CoinIcon size={18} className="text-primary" />
              <span id={summaryId} className="min-w-0 truncate" title={expenseSummary}>
                {expenseSummary}
              </span>
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
              className="pointer-events-auto flex items-center gap-1.5 text-body-s-regular text-text-disabled"
            >
              <CoinIcon size={18} className="text-icon-disabled" />
              비용 추가
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function PlaceMemo({
  place,
  addWhenEmpty,
  onEditMemo,
}: Pick<MobilePlanPlaceCardProps, "place" | "addWhenEmpty" | "onEditMemo">) {
  const [memoExpanded, setMemoExpanded] = useState(false);
  const memo = place.memo?.trim() ?? "";
  const [textRef, truncated] = useTruncated<HTMLSpanElement>(memo);
  const showChevron = memoExpanded || truncated || memo.includes("\n");
  const addMemo = !memo && Boolean(addWhenEmpty?.memo);
  return (
    <>
      {memo ? (
        <div className="pointer-events-none relative flex items-start gap-2.5 border-t border-border pb-3.5 pl-1 pt-3.25">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onEditMemo();
            }}
            aria-label={`${place.title} 메모 수정`}
            className="pointer-events-auto -m-2.5 grid size-10 shrink-0 place-items-center"
          >
            <MemoIcon size={18} className="text-icon-subtle" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              setMemoExpanded((v) => !v);
            }}
            aria-expanded={memoExpanded}
            aria-label={memoExpanded ? "메모 접기" : "메모 펼치기"}
            className="pointer-events-auto -my-2.5 -mr-2.5 flex min-w-0 flex-1 items-start gap-0.5 py-2.5 pr-2.5 text-left"
          >
            <span
              ref={textRef}
              className={cn(
                "min-w-0 flex-1 text-body-s-regular text-text-subtle",
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
            {showChevron ? (
              <ChevronDownIcon
                size={20}
                className={cn("shrink-0 text-icon-subtle transition-transform", memoExpanded && "rotate-180")}
              />
            ) : null}
          </button>
        </div>
      ) : null}
      {!memo && addMemo ? (
        <div className="pointer-events-none relative border-t border-border pb-3.5 pl-1 pt-3.25">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onEditMemo();
            }}
            aria-label={`${place.title} 메모 추가`}
            className="pointer-events-auto flex w-full min-w-0 items-center gap-2.5 text-left"
          >
            <MemoIcon size={18} className="shrink-0 text-icon-disabled" />
            <span className="min-w-0 flex-1 truncate text-body-s-regular text-text-disabled">메모를 추가해보세요.</span>
          </button>
        </div>
      ) : null}
    </>
  );
}

function useTruncated<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);
  return [ref, truncated] as const;
}
