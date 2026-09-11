"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { analyticsConsentStore } from "@/lib/analytics/consent-store";
import {
  AnalyticsEvents,
  trackAnalyticsEvent,
  type LandingSectionId,
} from "@/lib/analytics/track";

const sectionIds: readonly LandingSectionId[] = [
  "hero", "problem", "solution", "features", "devices", "travel_steps", "final_cta",
];
// Browser document lifetime, independent of component/consent lifetime. The root
// tracker observes all pathname transitions; query/hash changes do not reset it.
let visitPathname: string | null = null;
const counted = new Set<LandingSectionId>();

export function LandingSectionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (visitPathname !== pathname) {
      visitPathname = pathname;
      counted.clear();
    }
    if (pathname !== "/") return;

    const timers = new Map<LandingSectionId, ReturnType<typeof setTimeout>>();
    let frame: number | undefined;
    let stopped = false;
    const eligible = (id: LandingSectionId) => {
      if (!analyticsConsentStore.isGranted() || document.visibilityState !== "visible") return false;
      const element = document.querySelector<HTMLElement>(`section[data-landing-section="${id}"]`);
      if (!element) return false;
      const { top, bottom, height } = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visiblePixels = Math.max(0, Math.min(bottom, viewportHeight) - Math.max(top, 0));
      return height > 0 && viewportHeight > 0 && visiblePixels >= Math.min(height, viewportHeight) * 0.5;
    };
    const reset = () => {
      timers.forEach(clearTimeout);
      timers.clear();
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
    };
    const evaluate = () => {
      for (const id of sectionIds) {
        if (counted.has(id)) continue;
        if (!eligible(id)) {
          clearTimeout(timers.get(id));
          timers.delete(id);
        } else if (!timers.has(id)) {
          timers.set(id, setTimeout(() => {
            timers.delete(id);
            if (stopped || !eligible(id) || counted.has(id)) return;
            counted.add(id);
            trackAnalyticsEvent(AnalyticsEvents.sectionView, { page_type: "landing", section_id: id });
          }, 1000));
        }
      }
    };
    const tick = () => {
      evaluate();
      // Sampling rendered geometry also catches layout shifts with no scroll or
      // resize event, including upstream content and responsive image changes.
      frame = requestAnimationFrame(tick);
    };
    const restart = () => {
      reset();
      if (!stopped && analyticsConsentStore.isGranted() && document.visibilityState === "visible") tick();
    };
    const unsubscribe = analyticsConsentStore.subscribe(restart);
    document.addEventListener("visibilitychange", restart);
    window.addEventListener("resize", evaluate);
    window.addEventListener("scroll", evaluate, true);
    restart();
    return () => {
      stopped = true;
      reset();
      unsubscribe();
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("scroll", evaluate, true);
    };
  }, [pathname]);

  return null;
}
