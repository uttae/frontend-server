"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

/** `mousedown`이 `ref` 밖에서 일어나면 `onOutside` 호출 (열린 메뉴·드롭다운 닫기용) */
export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
): void {
  const saved = useRef(onOutside);
  useLayoutEffect(() => {
    saved.current = onOutside;
  }, [onOutside]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        saved.current();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref]);
}
