"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

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
