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
import { SHEET_DISMISS_DISTANCE } from "@/components/mobile/sheet-gesture";
import { cn } from "@/lib/utils";

const PEEK_FALLBACK_PX = 412;
const DRAG_START_THRESHOLD_PX = 6;
const FLING_VELOCITY = 0.6;
const SETTLE_TRANSITION = "transform 380ms cubic-bezier(0.25, 0.8, 0.25, 1)";

const SCROLL_AREA_CLASS =
  "min-h-0 flex-1 overscroll-contain [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent";

type DragState = {
  startY: number;
  startedExpanded: boolean;
  baseOffset: number;
  fromHeader: boolean;
  atTop: boolean;
  dragging: boolean;
  lastY: number;
  lastTime: number;
  velocity: number;
};

type PlaceDetailSheetProps = Readonly<{
  placeKey: string;
  onBack: () => void;
  onClose: () => void;
  peek: ReactNode;
  peekHiddenBottomPx?: number;
  children: ReactNode;
}>;

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

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    function handleStart(e: globalThis.TouchEvent) {
      if (e.touches.length !== 1 || (e.target as Element).closest("button, input, textarea, select, a")) {
        dragRef.current = null;
        return;
      }
      const y = e.touches[0].clientY;
      dragRef.current = {
        startY: y,
        startedExpanded: expandedRef.current,
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
      let resisted = next;
      if (next < 0) resisted = next / 4;
      else if (next > max) resisted = max + (next - max) / 4;
      applyOffset(resisted, false);
    }

    function handleEnd(event: TouchEvent) {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.dragging) return;
      if (event.type === "touchcancel") {
        snapTo(drag.startedExpanded);
        return;
      }
      if (!drag.startedExpanded && drag.lastY - drag.startY >= SHEET_DISMISS_DISTANCE) {
        onClose();
        return;
      }
      const max = collapsedOffsetRef.current;
      let nextExpanded = offsetRef.current < max / 2;
      if (drag.velocity < -FLING_VELOCITY) nextExpanded = true;
      else if (drag.velocity > FLING_VELOCITY) nextExpanded = false;
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
  }, [applyOffset, snapTo, onClose]);

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
        <div aria-hidden className="flex w-full justify-center pt-3">
          <span className="h-1 w-9 rounded-[2px] bg-border-subtle" />
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
