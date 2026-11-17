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
  /** 지도 핀과 같은 일차 색 */
  badgeColor: string;
  /** 방금 추가된 카드 — 잠깐 강조한다 */
  highlighted?: boolean;
  /** 대표 통화 원금액 요약 `30 USD 외 1건` — 없으면 비용 줄을 숨긴다 */
  expenseSummary: string | null;
  /** 카드 본문 — 없으면 본문을 눌러도 아무 일도 없다(예: 경로 보기에서 펼친 카드) */
  onOpen?: () => void;
  /** 본문 버튼의 접근성 이름 끝말 — 기본 "경로 보기" */
  openLabel?: string;
  onOpenActions: () => void;
  onOpenExpenses: () => void;
  /** 메모 줄의 메모 아이콘 — 메모 수정 시트를 연다 */
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
          "relative min-w-0 flex-1 rounded-md border px-4 text-left transition-colors duration-500",
          // primary-subtle은 카드 배경으로 너무 진해 빈 일차 드롭존과 같은 원시 토큰을 쓴다
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
              // 번호(24)를 제목 첫 줄(26) 가운데에 둔다. radius 4는 맞는 토큰이 없다(rounded-sm = 6px)
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
              <PlaceTimeAndExpense place={place} expenseSummary={expenseSummary}
                addWhenEmpty={addWhenEmpty} onEditTime={onEditTime} onOpenExpenses={onOpenExpenses} />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onOpenActions();
            }}
            aria-label={`${place.title} 일정 편집`}
            // 아이콘은 Figma 20, 누르는 영역은 40으로 넓히고 음수 margin으로 자리를 되돌린다
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

/** 분류·주소 줄 — 좁은 화면에서 잘렸을 때만 눌러서 전체 주소를 아래 드롭다운으로 보여 준다 */
function PlaceMeta({ place, meta }: Readonly<{ place: PlanPlace; meta: string }>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [textRef, truncated] = useTruncated<HTMLParagraphElement>(meta);
  const addressId = useId();
  const [open, setOpen] = useState(false);
  useOnClickOutside(wrapRef, () => setOpen(false));

  const expandable = truncated && Boolean(place.subtitle);
  return (
    <div ref={wrapRef} className="relative">
      <p ref={textRef} className="truncate text-body-s-regular text-text-subtle">{meta}</p>
      {expandable ? (
        // 잘리지 않았으면 버튼을 두지 않아 이 줄을 눌러도 카드 본문(열기)이 눌린다
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
        // pointer-events-auto: 드롭다운을 눌러도 아래 카드 본문(열기)이 눌리지 않게 막는다
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

function PlaceTimeAndExpense({ place, expenseSummary, addWhenEmpty, onEditTime, onOpenExpenses }:
  Pick<MobilePlanPlaceCardProps, "place" | "expenseSummary" | "addWhenEmpty" | "onEditTime" | "onOpenExpenses">) {
  const summaryId = useId();
  const timeRange = formatScheduleTimeRange(place.startTime ?? "", place.endTime);
  const addTime = !timeRange && Boolean(addWhenEmpty?.time);
  const addExpense = !expenseSummary && Boolean(addWhenEmpty?.expense);
  return <>
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
                    <span id={summaryId} className="min-w-0 truncate" title={expenseSummary}>{expenseSummary}</span>
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
  </>;
}

function PlaceMemo({ place, addWhenEmpty, onEditMemo }:
  Pick<MobilePlanPlaceCardProps, "place" | "addWhenEmpty" | "onEditMemo">) {
  const [memoExpanded, setMemoExpanded] = useState(false);
  const memo = place.memo?.trim() ?? "";
  const [textRef, truncated] = useTruncated<HTMLSpanElement>(memo);
  // Figma: 한 줄에 다 보이면 펼치기 화살표를 두지 않는다. 줄바꿈이 있으면 펼쳤을 때 줄이 늘어나므로 보인다
  const showChevron = memoExpanded || truncated || memo.includes("\n");
  const addMemo = !memo && Boolean(addWhenEmpty?.memo);
  return <>
        {memo ? (
          // Figma 선은 높이 48 안의 안쪽 stroke라 위 여백에서 1을 뺀다
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
              className="pointer-events-auto flex min-w-0 flex-1 items-start gap-0.5 text-left"
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
                  className={cn(
                    "shrink-0 text-icon-subtle transition-transform",
                    memoExpanded && "rotate-180",
                  )}
                />
              ) : null}
            </button>
          </div>
        ) : null}
        {!memo && addMemo ? (
          // 메모가 있을 때와 같은 줄(구분선·아이콘)을 흐리게 — 펼칠 내용이 없어 꺾쇠는 두지 않는다. 누르면 메모 시트
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
              <span className="min-w-0 flex-1 truncate text-body-s-regular text-text-disabled">
                메모를 추가해보세요.
              </span>
            </button>
          </div>
        ) : null}
  </>;
}

/** 한 줄 말줄임 글자가 잘렸는지 — 카드 폭(회전·넘겨 보기 칸)이 바뀌면 다시 잰다 */
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
