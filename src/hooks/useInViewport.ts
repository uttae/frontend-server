"use client";

import { useEffect, useState } from "react";

export function useInViewport<T extends Element>(options?: {
  enabled?: boolean;
  rootMargin?: string;
}): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [inViewport, setInViewport] = useState(false);
  const enabled = options?.enabled ?? true;
  const rootMargin = options?.rootMargin ?? "240px";
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!node) return;
    if (!supportsIntersectionObserver) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, node, rootMargin, supportsIntersectionObserver]);

  return [setNode, enabled && (!supportsIntersectionObserver || inViewport)];
}
