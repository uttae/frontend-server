"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSessionUser } from "@/hooks/useSessionUser";
import { trackAnalyticsPageView } from "@/lib/analytics/client";
import {
  buildSessionPageViewPlan,
  executeSessionPageViewPlan,
} from "@/lib/analytics/page-view-session";
import { resolveAnalyticsRoomId } from "@/lib/analytics/room-context";
import { setAnalyticsUserId } from "@/lib/analytics/track";
import { shouldSkipReconcileClientSession } from "@/lib/auth-session";
import { useSessionStore } from "@/stores/session-store";

export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const currentRoomId = useSessionStore((state) => state.currentRoomId);
  const sessionReady = useSessionStore((state) => state.sessionReady);
  const { data: user, status: queryStatus } = useSessionUser();
  const userId = user?.id;
  const lastTrackedPathname = useRef<string | null>(null);
  const lastTrackedRoomId = useRef<string | undefined>(undefined);
  const previousPageLocation = useRef<string | null>(null);

  useEffect(() => {
    const plan = buildSessionPageViewPlan({
      origin: window.location.origin,
      pathname,
      referrer: previousPageLocation.current ?? document.referrer,
      search: window.location.search,
      title: document.title,
      lastTrackedPathname: lastTrackedPathname.current,
      queryStatus,
      currentRoomId: useSessionStore.getState().currentRoomId,
      lastTrackedRoomId: lastTrackedRoomId.current,
      // SessionReconciler의 layout effect가 같은 commit에서 갱신한 값을 읽는다.
      sessionReady: useSessionStore.getState().sessionReady,
      skipSessionReconciliation:
        shouldSkipReconcileClientSession(pathname),
      userId,
    });

    if (!plan) return;

    executeSessionPageViewPlan(plan, {
      setUserId: setAnalyticsUserId,
      trackPageView: trackAnalyticsPageView,
    });

    const observedRoomId = resolveAnalyticsRoomId({
      pathname,
      currentRoomId: useSessionStore.getState().currentRoomId,
      sessionReady: useSessionStore.getState().sessionReady,
      userId: plan.userId,
    });
    if (!plan.pageView) {
      // Enrich dedupe context without resending the anonymous view. A later
      // real A → B room switch on this pathname can then count as navigation.
      if (lastTrackedPathname.current === pathname && observedRoomId) {
        lastTrackedRoomId.current = observedRoomId;
      }
      return;
    }
    lastTrackedPathname.current = pathname;
    lastTrackedRoomId.current = plan.pageView.room_id;
    previousPageLocation.current = plan.pageView.page_location;
  }, [pathname, queryStatus, sessionReady, userId, currentRoomId]);

  return null;
}
