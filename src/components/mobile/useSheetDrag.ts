"use client";

import { SHEET_DISMISS_DISTANCE } from "./sheet-gesture";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/**
 * Keep dragging on the fixed header so scrolling and form controls remain native.
 * 바텀시트는 모바일 기기에서만 쓰므로 화면 폭과 관계없이 `is-mobile-device`일 때만 끈다. 모바일 전용 시트는 `mobileOnly=false`.
 */
export function useSheetDrag(onClose: () => void, disabled = false, mobileOnly = true) {
  const gesture = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  function finish(event: PointerEvent<HTMLElement>, cancelled: boolean) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    setOffset(0);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && !disabled && current.distance >= SHEET_DISMISS_DISTANCE) onClose();
  }
  return {
    surfaceStyle: {
      transform: !disabled && offset > 0 ? `translateY(${offset}px)` : undefined,
      transition: dragging || reduceMotion ? "none" : "transform 180ms ease-out",
      animation: hasDragged ? "none" : undefined,
    } satisfies CSSProperties,
    handleProps: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
        if (mobileOnly && !document.documentElement.classList.contains("is-mobile-device")) return;
        if ((event.target as Element).closest("button, input, textarea, select, a, [role='button'], [contenteditable='true']")) return;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        setHasDragged(true);
        setReduceMotion(Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
        setDragging(true);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        if (disabled) { finish(event, true); return; }
        const distance = event.clientY - current.y;
        if (Math.abs(event.clientX - current.x) > Math.max(12, Math.abs(distance))) {
          finish(event, true);
          return;
        }
        current.distance = Math.max(0, distance);
        setOffset(current.distance);
      },
      onPointerUp(event: PointerEvent<HTMLElement>) { finish(event, false); },
      onPointerCancel(event: PointerEvent<HTMLElement>) { finish(event, true); },
      onLostPointerCapture(event: PointerEvent<HTMLElement>) { finish(event, true); },
    },
    handleClassName: `shrink-0 mobile:touch-none mobile:select-none ${dragging ? "mobile:cursor-grabbing" : "mobile:cursor-grab"}`,
  };
}
