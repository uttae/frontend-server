"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { MobilePlanPlaceCard } from "@/app/(main)/plan/_components/mobile/MobilePlanPlaceCard";
import { DashedBorder, DashedPlaceholderBox } from "@/components/mobile/DashedPlaceholderBox";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

const CARD_CLASS = "relative h-full overflow-hidden rounded-md border border-border-subtle bg-fill-subtle";
const COLLAPSE_DRAG_PX = 56;

type MobileRoutePlaceCardProps = Readonly<{
  place: PlanPlace;
  orderNumber: number;
  badgeColor: string;
  highlighted: boolean;
  expenseSummary: string | null;
  canAddExpense: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onOpenActions: () => void;
  onOpenExpenses: () => void;
  onEditMemo: () => void;
  onEditTime: () => void;
  detail: ReactNode;
}>;

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
      addWhenEmpty={{ time: true, expense: canAddExpense, memo: true }}
      className={expanded ? undefined : "h-full"}
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

export function MobileRouteExpandedShell({
  onCollapse,
  tentative = false,
  children,
}: Readonly<{
  onCollapse: () => void;
  tentative?: boolean;
  children: ReactNode;
}>) {
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
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
        className="relative z-10 -mb-3 flex w-full shrink-0 cursor-pointer touch-pan-x justify-center pb-3 pt-[11px]"
      >
        <span aria-hidden className="h-1 w-9 rounded-[2px] bg-border-subtle" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
    </div>
  );
}

export function MobileRoutePlaceCardSkeleton() {
  return (
    <output
      aria-label="장소 불러오는 중"
      aria-busy
      className={cn(CARD_CLASS, "flex min-h-[155px] gap-3 pl-3.5 pr-2 pt-3")}
    >
      <Skeleton render={<span />} className="size-6 shrink-0 rounded-[5.5px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <Skeleton render={<span />} className="h-5 w-2/3" />
        <Skeleton render={<span />} tone="subtle" className="h-4 w-1/2" />
        <Skeleton render={<span />} tone="subtle" className="mt-3 h-4 w-5/6" />
      </span>
    </output>
  );
}

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

export function MobileRouteMessageCard({
  title,
  description,
  tone = "default",
}: Readonly<{
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
