"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SCROLL_SETTLE_MS = 120;

type CarouselCard = { key: string; node: ReactNode };

export function MobileRouteCardCarousel({
  cards,
  focusedKey,
  onFocusChange,
  onPreviewChange,
}: Readonly<{
  cards: readonly CarouselCard[];
  focusedKey: string | null;
  onFocusChange: (index: number) => void;
  onPreviewChange?: (index: number | null) => void;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const fromScrollRef = useRef<string | null>(null);
  const scrollTargetRef = useRef<number | null>(null);
  const scrolledOnceRef = useRef(false);
  const previewRef = useRef<number | null>(null);
  const setPreview = (index: number | null) => {
    if (previewRef.current === index) return;
    previewRef.current = index;
    onPreviewChange?.(index);
  };

  const focusedIndex = cards.findIndex((card) => card.key === focusedKey);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || focusedIndex < 0) return;
    const fromScroll = fromScrollRef.current === focusedKey;
    fromScrollRef.current = null;
    if (fromScroll) return;
    const child = el.children[focusedIndex] as HTMLElement | undefined;
    if (!child) return;
    const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    scrollTargetRef.current = focusedIndex;
    el.scrollTo({ left, behavior: scrolledOnceRef.current ? "smooth" : "auto" });
    scrolledOnceRef.current = true;
  }, [focusedIndex, focusedKey]);

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    },
    [],
  );

  function nearestIndex(el: HTMLDivElement) {
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    Array.from(el.children).forEach((node, index) => {
      const child = node as HTMLElement;
      const distance = Math.abs(child.offsetLeft + child.clientWidth / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  function handleScroll() {
    const current = containerRef.current;
    if (current && scrollTargetRef.current === null) setPreview(nearestIndex(current));
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const index = nearestIndex(el);
      setPreview(null);
      if (scrollTargetRef.current !== null) {
        if (scrollTargetRef.current === index) scrollTargetRef.current = null;
        return;
      }
      const key = cards[index]?.key;
      if (key === undefined || key === focusedKey) return;
      fromScrollRef.current = key;
      onFocusChange(index);
    }, SCROLL_SETTLE_MS);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onPointerDown={() => {
        scrollTargetRef.current = null;
      }}
      className="pointer-events-auto relative flex h-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card) => (
        <div key={card.key} className="h-full w-full shrink-0 snap-center snap-always">
          {card.node}
        </div>
      ))}
    </div>
  );
}
