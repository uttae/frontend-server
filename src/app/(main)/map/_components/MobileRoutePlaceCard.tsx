"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { MobilePlanPlaceCard } from "@/app/(main)/plan/_components/mobile/MobilePlanPlaceCard";
import { DashedBorder, DashedPlaceholderBox } from "@/components/mobile/DashedPlaceholderBox";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

/** 넘겨 보는 카드 칸 — 높이는 넘겨 보는 줄이 정한다(접힘: 가장 긴 카드, 펼침: 지도의 70%) */
const CARD_CLASS = "relative h-full overflow-hidden rounded-md border border-border-subtle bg-fill-subtle";
/** 펼친 카드를 이만큼 아래로 끌면 접는다 */
const COLLAPSE_DRAG_PX = 56;

type MobileRoutePlaceCardProps = Readonly<{
  place: PlanPlace;
  orderNumber: number;
  /** 지도 핀·경로선과 같은 일차 색 */
  badgeColor: string;
  /** 방금 추가된 카드 — 잠깐 강조한다 */
  highlighted: boolean;
  /** `45,000 KRW 외 1건` — 없으면 비용 권한이 있을 때 "비용 추가"를 보인다 */
  expenseSummary: string | null;
  /** 비용을 추가할 수 있는지(비용 권한) */
  canAddExpense: boolean;
  expanded: boolean;
  /** 접힌 카드 본문 — 상세를 펼친다 */
  onExpand: () => void;
  /** 펼친 카드의 ⌄·아래로 끌기 — 접는다 */
  onCollapse: () => void;
  onOpenActions: () => void;
  onOpenExpenses: () => void;
  onEditMemo: () => void;
  onEditTime: () => void;
  /** 펼쳤을 때 카드 아래에 이어지는 상세 */
  detail: ReactNode;
}>;

/**
 * 경로 보기 장소 카드 — 일정 화면의 장소 카드(`MobilePlanPlaceCard`)를 그대로 쓴다(시간·비용·메모·⋮ 동작 같음).
 * 본문을 누르면 펼쳐 카드 아래에 상세를 잇고, 손잡이·⌄ 줄만 위에 남긴 채 카드부터 상세까지 함께 스크롤한다.
 */
export function MobileRoutePlaceCard({
  place,
  orderNumber,
  badgeColor,
  highlighted,
  expenseSummary,
  canAddExpense,
  expanded,
  onExpand,
  onCollapse,
  onOpenActions,
  onOpenExpenses,
  onEditMemo,
  onEditTime,
  detail,
}: MobileRoutePlaceCardProps) {
  const card = (
    <MobilePlanPlaceCard
      place={place}
      orderNumber={orderNumber}
      badgeColor={badgeColor}
      highlighted={highlighted}
      expenseSummary={expenseSummary}
      onOpen={expanded ? undefined : onExpand}
      openLabel="상세 보기"
      onOpenActions={onOpenActions}
      onOpenExpenses={onOpenExpenses}
      onEditMemo={onEditMemo}
      onEditTime={onEditTime}
      editing={false}
      // 넘겨 보는 카드는 가장 긴 카드에 높이를 맞추므로 빈 시간·비용·메모 자리를 "추가" 줄로 채운다
      addWhenEmpty={{ time: true, expense: canAddExpense, memo: true }}
      className={expanded ? undefined : "h-full"}
      // 펼친 카드는 바깥 테두리 안에 들어가므로 카드 자체의 테두리는 지운다
      articleClassName={expanded ? "rounded-none border-0 bg-transparent" : undefined}
    />
  );

  if (!expanded) return card;

  return (
    <MobileRouteExpandedShell onCollapse={onCollapse}>
      {card}
      {detail}
    </MobileRouteExpandedShell>
  );
}

/**
 * 펼친 경로 카드의 틀 — 손잡이·⌄ 줄만 위에 남기고 나머지는 함께 스크롤한다.
 * 손잡이 줄을 누르거나 아래로 끌면 접는다. 장소 카드와 지도에서 고른 후보 카드가 함께 쓴다.
 */
export function MobileRouteExpandedShell({
  onCollapse,
  tentative = false,
  children,
}: Readonly<{
  onCollapse: () => void;
  /** 아직 일정에 넣지 않은 후보 — 접힌 후보 카드처럼 점선 테두리 */
  tentative?: boolean;
  children: ReactNode;
}>) {
  // 가로 넘기기는 브라우저 스크롤에 맡긴다(`touch-action: pan-x`)
  const dragStartYRef = useRef<number | null>(null);
  // 손을 뗄 때는 렌더 전 최신 거리가 필요해 ref에도 둔다(화면 이동은 상태로 그린다)
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  // 끌다가 놓으면 이어서 click이 오므로, 끈 경우엔 그 click으로 접지 않는다(덜 끌었으면 제자리로)
  const draggedRef = useRef(false);
  const resetDrag = () => {
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  return (
    <div
      className={cn(CARD_CLASS, "flex flex-col", tentative && "border-transparent")}
      style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
    >
      {/* 카드가 테두리를 자르므로(overflow-hidden) 반 픽셀 안쪽에 그린다 */}
      {tentative ? <DashedBorder active className="inset-[0.5px] size-[calc(100%-1px)]" /> : null}
      <button
        type="button"
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          onCollapse();
        }}
        aria-label="상세 접기"
        onPointerDown={(e: ReactPointerEvent) => {
          dragStartYRef.current = e.clientY;
        }}
        onPointerMove={(e: ReactPointerEvent) => {
          if (dragStartYRef.current === null) return;
          dragOffsetRef.current = Math.max(0, e.clientY - dragStartYRef.current);
          setDragOffset(dragOffsetRef.current);
        }}
        onPointerUp={() => {
          draggedRef.current = dragOffsetRef.current > 8;
          if (dragOffsetRef.current >= COLLAPSE_DRAG_PX) onCollapse();
          resetDrag();
        }}
        onPointerCancel={resetDrag}
        className="flex h-8 w-full shrink-0 cursor-pointer touch-pan-x items-end justify-center pb-2"
      >
        <span aria-hidden className="h-[3px] w-10 rounded-full bg-icon-disabled" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

/** 처음 불러오는 동안 — 카드와 같은 자리를 잡는다 */
export function MobileRoutePlaceCardSkeleton() {
  return (
    <output aria-label="장소 불러오는 중" aria-busy className={`${CARD_CLASS} flex min-h-[155px] gap-3 pl-3.5 pr-2 pt-3`}>
      <span className="size-6 shrink-0 animate-pulse rounded-[5.5px] bg-fill-strong" />
      <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <span className="h-5 w-2/3 animate-pulse rounded bg-fill-strong" />
        <span className="h-4 w-1/2 animate-pulse rounded bg-fill" />
        <span className="mt-3 h-4 w-5/6 animate-pulse rounded bg-fill" />
      </span>
    </output>
  );
}

/** Figma ⑤ 장소 없는 일차 — 어느 일차인지 제목을 두고, 일정 화면의 빈 일차처럼 점선 박스로 비어 있음을 보여 준다 */
export function MobileRouteEmptyDayCard({ dayNumber }: Readonly<{ dayNumber: number }>) {
  return (
    <div className={`${CARD_CLASS} flex min-h-[155px] flex-col items-center gap-2 px-3.5 pb-3.5 pt-3`}>
      <p className="text-label-m-emphasis text-text">Day {dayNumber}</p>
      <DashedPlaceholderBox className="w-full flex-1 flex-col gap-0.5 px-4 py-3 text-center">
        <p className="text-body-s-emphasis text-text">장소가 없어요</p>
        <p className="text-body-xs-regular text-text-subtle">지도에서 장소를 추가해 보세요.</p>
      </DashedPlaceholderBox>
    </div>
  );
}

/** 일정이 없거나 불러오지 못했을 때 — 장소카드 자리에 안내를 보여 준다 */
export function MobileRouteMessageCard({ title, description, tone = "default" }: Readonly<{
  title: string;
  description: string;
  tone?: "default" | "error";
}>) {
  return (
    <div className={`${CARD_CLASS} flex min-h-[155px] flex-col justify-center gap-1 px-5`}>
      <p className={tone === "error" ? "text-title-s text-status-negative" : "text-title-s text-text"}>{title}</p>
      <p className="text-body-s-regular text-text-subtle">{description}</p>
    </div>
  );
}
