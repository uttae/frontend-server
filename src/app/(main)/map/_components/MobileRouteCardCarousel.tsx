"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** 손을 뗀 뒤 스냅이 멈출 때까지 기다렸다가 고른 카드를 알린다 — 넘기는 중 지도가 여러 번 움직이지 않게 */
const SCROLL_SETTLE_MS = 120;

type CarouselCard = { key: string; node: ReactNode };

/**
 * 카드를 가로로 넘겨 본다 — 가운데 카드가 고른 카드이고 양옆 카드가 조금 보인다.
 * 카드를 넘기면 `onFocusChange`로 알리고, 바깥(지도 핀·일차 탭·처음 진입·삭제)에서 고른 카드가 바뀌면 그 카드로 옮긴다.
 * 넘기는 중에는 `onPreviewChange`로 지금 가운데 카드를 바로 알린다 — 일차 탭처럼 가벼운 표시만 먼저 바꾸는 데 쓴다.
 */
export function MobileRouteCardCarousel({
  cards,
  focusedKey,
  onFocusChange,
  onPreviewChange,
}: Readonly<{
  cards: readonly CarouselCard[];
  focusedKey: string | null;
  onFocusChange: (index: number) => void;
  /** 넘기는 중 가운데 카드(멈추면 null) */
  onPreviewChange?: (index: number | null) => void;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  /** 카드를 넘겨서 고른 카드 — 이 경우엔 다시 스크롤하지 않는다(한 번 쓰고 비운다) */
  const fromScrollRef = useRef<string | null>(null);
  /** 코드로 옮기는 중인 카드 — 도착할 때까지 스크롤로 고르지 않는다. 사용자가 카드 줄을 만지면 버린다 */
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
    // 넘겨서 고른 직후엔 이미 그 자리에 있다. 기록은 비워 두어, 나중에 코드로 같은 카드를 다시 고르거나
    // 카드가 끼워지고 빠져 자리가 밀려도 그 카드로 옮기게 한다
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
    // 코드로 옮기는 중엔 목적지가 이미 골라져 있으니 지나가는 카드를 알리지 않는다
    const current = containerRef.current;
    if (current && scrollTargetRef.current === null) setPreview(nearestIndex(current));
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const index = nearestIndex(el);
      // 같은 타이머 안이라 아래 onFocusChange와 함께 한 번에 그려진다
      setPreview(null);
      // 코드로 옮기는 중이면 이미 고른 카드다 — 도착했을 때만 표시를 지운다(도중에 멈칫한 건 무시)
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
      // 코드로 옮기는 중에 사용자가 넘기면 손을 따른다 — 목적지를 버려야 멈춘 카드를 고르고 일차 탭도 따라온다
      onPointerDown={() => {
        scrollTargetRef.current = null;
      }}
      // relative: 카드 위치(offsetLeft)를 카드 줄 기준으로 재서 브라우저마다 같은 값이 나오게 한다
      className="pointer-events-auto relative flex h-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card) => (
        // 카드 폭은 좌우 여백(18px)을 뺀 전체 — 393px 화면에서 Figma처럼 357px, 옆 카드가 10px 보인다
        <div key={card.key} className="h-full w-full shrink-0 snap-center snap-always">
          {card.node}
        </div>
      ))}
    </div>
  );
}
