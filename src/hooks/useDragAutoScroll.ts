"use client";

import { useEffect, useRef, type RefObject } from "react";

import { resolveMainContentScrollRoot } from "@/lib/dnd/mainContentScroll";

export type UseDragAutoScrollOptions = {
  active: boolean;
  scrollRootRef?: RefObject<HTMLElement | null>;
  edgeZone?: number;
  maxSpeed?: number;
};

function resolveScrollRoot(
  scrollRootRef?: RefObject<HTMLElement | null>,
): HTMLElement | null {
  if (scrollRootRef?.current) return scrollRootRef.current;
  return resolveMainContentScrollRoot();
}

function applyEdgeAutoScroll(
  scrollRoot: HTMLElement,
  clientY: number,
  edgeZone: number,
  maxSpeed: number,
): void {
  const rect = scrollRoot.getBoundingClientRect();
  const distFromTop = clientY - rect.top;
  const distFromBottom = rect.bottom - clientY;

  const { scrollTop, scrollHeight, clientHeight } = scrollRoot;
  const canScrollUp = scrollTop > 0;
  const canScrollDown = scrollTop + clientHeight < scrollHeight - 1;

  if (distFromTop < edgeZone && canScrollUp) {
    const ratio = (edgeZone - distFromTop) / edgeZone;
    scrollRoot.scrollTop -= maxSpeed * ratio;
    return;
  }

  if (distFromBottom < edgeZone && canScrollDown) {
    const ratio = (edgeZone - distFromBottom) / edgeZone;
    scrollRoot.scrollTop += maxSpeed * ratio;
  }
}

export function useDragAutoScroll({
  active,
  scrollRootRef,
  edgeZone = 56,
  maxSpeed = 14,
}: UseDragAutoScrollOptions): void {
  const pointerYRef = useRef(0);
  const scrollRootRefRef = useRef(scrollRootRef);

  useEffect(() => {
    scrollRootRefRef.current = scrollRootRef;
  }, [scrollRootRef]);

  useEffect(() => {
    if (!active) return;

    let rafId = 0;

    const onDragOver = (e: DragEvent) => {
      pointerYRef.current = e.clientY;
      e.preventDefault();
    };

    const tick = () => {
      const scrollRoot = resolveScrollRoot(scrollRootRefRef.current);
      if (scrollRoot) {
        applyEdgeAutoScroll(
          scrollRoot,
          pointerYRef.current,
          edgeZone,
          maxSpeed,
        );
      }
      rafId = requestAnimationFrame(tick);
    };

    document.addEventListener("dragover", onDragOver);
    rafId = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(rafId);
    };
  }, [active, edgeZone, maxSpeed]);
}
