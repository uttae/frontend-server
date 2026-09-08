"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type RevealState = "static" | "hidden" | "shown";

type LandingMotionProps = {
  children: ReactNode;
  className?: string;
};

// motion-reduce:transition-none은 방어층: matchMedia 가드는 마운트 시 1회만 평가되므로
// 이후 OS 설정이 reduce로 바뀐 경우에도 전환 애니메이션을 차단한다.
const TRANSITION_CLASSES =
  "transition-[opacity,transform] duration-800 ease-out motion-reduce:transition-none";

export function LandingMotion({ children, className }: LandingMotionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (element.getBoundingClientRect().top < window.innerHeight) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 뷰포트 하단 요소를 첫 페인트 이전에 hidden 상태로 동기화
    setState("hidden");

    const reveal = () => {
      setState("shown");
      observer.disconnect();
      element.removeEventListener("focusin", reveal);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    // 키보드 포커스가 IntersectionObserver보다 먼저 숨겨진 섹션에 들어올 수 있으므로 즉시 공개한다.
    element.addEventListener("focusin", reveal);

    return () => {
      observer.disconnect();
      element.removeEventListener("focusin", reveal);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        state === "hidden" &&
          cn(TRANSITION_CLASSES, "pointer-events-none translate-y-3 opacity-0"),
        state === "shown" && cn(TRANSITION_CLASSES, "translate-y-0 opacity-100"),
        className,
      )}
    >
      {children}
    </div>
  );
}
