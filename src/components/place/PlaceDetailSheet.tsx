"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";

import { ChevronLeftIcon, CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

/** Figma 기준 peek 영역 높이(핸들~사진 끝) — 실측 전 초기값 */
const PEEK_FALLBACK_PX = 412;
/** 이 거리(px) 이상 움직여야 시트 드래그로 판단 — 그 전엔 탭(버튼 클릭)으로 둔다 */
const DRAG_START_THRESHOLD_PX = 6;
/** 손을 뗄 때 이 속도(px/ms) 이상으로 튕긴 경우만 방향대로, 아니면 가까운 위치(최대화/중간)로 이동 */
const FLING_VELOCITY = 0.6;
const SETTLE_TRANSITION = "transform 380ms cubic-bezier(0.25, 0.8, 0.25, 1)";

const SCROLL_AREA_CLASS =
  "min-h-0 flex-1 overscroll-contain [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent";

type DragState = {
  startY: number;
  /** 드래그 시작 시 시트 위치(translateY px) */
  baseOffset: number;
  fromHeader: boolean;
  atTop: boolean;
  dragging: boolean;
  lastY: number;
  lastTime: number;
  velocity: number;
};

type PlaceDetailSheetProps = {
  /** 바뀌면 다시 peek 상태로 시작한다 */
  placeKey: string;
  onBack: () => void;
  onClose: () => void;
  /** 처음 보이는 영역 — 장소 정보·버튼·사진 */
  peek: ReactNode;
  /** 중간 상태에서 `peek` 아래쪽을 가릴 높이(px) — 예: 사진의 3/5 */
  peekHiddenBottomPx?: number;
  children: ReactNode;
};

/**
 * 모바일 바텀 시트 — 상태는 최대화 / 중간 두 가지.
 * 처음엔 중간(`peek`에서 `peekHiddenBottomPx`만큼 가린 위치)으로 열리고, 손가락을 따라 끌어올리면 컨테이너 끝까지 펼쳐진다.
 * 최대화 상태에서는 헤더를 잡거나 본문이 맨 위일 때 아래로 끌어 중간으로 내린다. 그 외에는 본문이 스크롤된다.
 */
export function PlaceDetailSheet({
  placeKey,
  onBack,
  onClose,
  peek,
  peekHiddenBottomPx = 0,
  children,
}: PlaceDetailSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [sizes, setSizes] = useState({ sheet: 0, peek: PEEK_FALLBACK_PX });
  const sheetRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const expandedRef = useRef(expanded);
  const offsetRef = useRef(0);

  /** 중간 상태의 translateY — 시트 높이에서 보이는 peek 높이를 뺀 만큼 내려간다 */
  const collapsedOffset = Math.max(0, sizes.sheet - (sizes.peek - peekHiddenBottomPx));
  const collapsedOffsetRef = useRef(collapsedOffset);

  const [previousPlaceKey, setPreviousPlaceKey] = useState(placeKey);
  if (previousPlaceKey !== placeKey) {
    setPreviousPlaceKey(placeKey);
    setExpanded(false);
  }

  const applyOffset = useCallback((offset: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    offsetRef.current = offset;
    el.style.transition = animate ? SETTLE_TRANSITION : "none";
    el.style.transform = `translateY(${offset}px)`;
  }, []);

  // 첫 페인트 전에 재서 시트가 펼친 위치에서 내려오는 애니메이션이 보이지 않게 한다
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const header = headerRef.current;
    const peekEl = peekRef.current;
    if (!sheet || !header || !peekEl) return;
    const measure = () =>
      setSizes({
        sheet: sheet.offsetHeight,
        peek: header.offsetHeight + peekEl.offsetHeight,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sheet);
    observer.observe(header);
    observer.observe(peekEl);
    return () => observer.disconnect();
  }, []);

  // 스냅 위치가 바뀌면(펼침/접힘, 크기 변경) 드래그 중이 아닐 때 그 위치로 이동
  const hasPositionedRef = useRef(false);
  useLayoutEffect(() => {
    expandedRef.current = expanded;
    collapsedOffsetRef.current = collapsedOffset;
    if (dragRef.current?.dragging) return;
    applyOffset(expanded ? 0 : collapsedOffset, hasPositionedRef.current);
    if (sizes.sheet > 0) hasPositionedRef.current = true;
  }, [applyOffset, collapsedOffset, expanded, sizes.sheet]);

  const snapTo = useCallback(
    (nextExpanded: boolean) => {
      if (!nextExpanded) scrollRef.current?.scrollTo({ top: 0 });
      expandedRef.current = nextExpanded;
      setExpanded(nextExpanded);
      applyOffset(nextExpanded ? 0 : collapsedOffsetRef.current, true);
    },
    [applyOffset],
  );

  // touchmove에서 preventDefault 하려면 passive: false 리스너가 필요해 직접 등록한다
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    function handleStart(e: globalThis.TouchEvent) {
      if (e.touches.length !== 1) {
        dragRef.current = null;
        return;
      }
      const y = e.touches[0].clientY;
      dragRef.current = {
        startY: y,
        baseOffset: offsetRef.current,
        fromHeader: headerRef.current?.contains(e.target as Node) ?? false,
        atTop: (scrollRef.current?.scrollTop ?? 0) <= 0,
        dragging: false,
        lastY: y,
        lastTime: e.timeStamp,
        velocity: 0,
      };
    }

    function handleMove(e: globalThis.TouchEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const y = e.touches[0].clientY;
      const dy = y - drag.startY;

      if (!drag.dragging) {
        if (Math.abs(dy) < DRAG_START_THRESHOLD_PX) return;
        // 펼친 상태에서 본문을 스크롤하려는 제스처는 시트가 가로채지 않는다
        const canDrag =
          !expandedRef.current || drag.fromHeader || (drag.atTop && dy > 0);
        if (!canDrag) {
          dragRef.current = null;
          return;
        }
        drag.dragging = true;
      }

      e.preventDefault();
      const dt = e.timeStamp - drag.lastTime;
      if (dt > 0) drag.velocity = (y - drag.lastY) / dt;
      drag.lastY = y;
      drag.lastTime = e.timeStamp;

      const max = collapsedOffsetRef.current;
      const next = drag.baseOffset + dy;
      // 범위를 넘으면 저항을 줘서 끝에 닿았음을 느끼게 한다
      const resisted =
        next < 0 ? next / 4 : next > max ? max + (next - max) / 4 : next;
      applyOffset(resisted, false);
    }

    function handleEnd() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.dragging) return;
      const max = collapsedOffsetRef.current;
      const nextExpanded =
        drag.velocity < -FLING_VELOCITY
          ? true
          : drag.velocity > FLING_VELOCITY
            ? false
            : offsetRef.current < max / 2;
      snapTo(nextExpanded);
    }

    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", handleEnd);
    el.addEventListener("touchcancel", handleEnd);
    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [applyOffset, snapTo]);

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (!expanded && e.deltaY > 0) snapTo(true);
    else if (expanded && e.deltaY < 0 && (scrollRef.current?.scrollTop ?? 0) <= 0) {
      snapTo(false);
    }
  }

  return (
    <div
      ref={sheetRef}
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 flex h-full flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-6px_24px_-4px_rgba(0,0,0,0.12)] will-change-transform",
        !expanded && "touch-none",
      )}
      onWheel={handleWheel}
    >
      <div ref={headerRef} className="shrink-0">
        <div aria-hidden className="flex h-3 w-full items-end justify-center">
          <span className="h-[3px] w-10 rounded-full bg-icon-disabled" />
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로가기"
            className="flex size-12 items-center justify-center"
          >
            <ChevronLeftIcon className="text-icon" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-12 items-center justify-center"
          >
            <CloseIcon className="text-icon" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(SCROLL_AREA_CLASS, expanded ? "overflow-y-auto" : "overflow-hidden")}
      >
        <div ref={peekRef}>{peek}</div>
        {children}
      </div>
    </div>
  );
}
