import {
  isAnalyticsRoomPath,
  resolveAnalyticsRoomId,
  resolveSelectedAnalyticsRoomId,
} from "@/lib/analytics/room-context";
import {
  buildAnalyticsPageView,
  type AnalyticsPageViewInput,
  type AnalyticsPageViewParams,
} from "@/lib/analytics/context";

export type SessionUserQueryStatus = "error" | "pending" | "success";

export type SessionPageViewPlanInput = AnalyticsPageViewInput & {
  lastTrackedPathname: string | null;
  lastTrackedRoomId?: string;
  currentRoomId?: string | null;
  queryStatus: SessionUserQueryStatus;
  sessionReady: boolean;
  skipSessionReconciliation: boolean;
  userId: number | undefined;
};

export type SessionPageViewPlan = {
  pageView: AnalyticsPageViewParams | null;
  userId: number | null;
};

export type SessionPageViewPlanExecutor = {
  setUserId: (userId: number | null) => void;
  trackPageView: (pageView: AnalyticsPageViewParams) => void;
};

export function buildSessionPageViewPlan({
  lastTrackedPathname,
  lastTrackedRoomId,
  currentRoomId,
  queryStatus,
  sessionReady,
  skipSessionReconciliation,
  userId,
  ...pageViewInput
}: SessionPageViewPlanInput): SessionPageViewPlan | null {
  if (
    !skipSessionReconciliation &&
    (!sessionReady || queryStatus === "pending")
  ) {
    return null;
  }

  const confirmedUserId =
    !skipSessionReconciliation && queryStatus === "success"
      ? (userId ?? null)
      : null;
  const roomId = resolveAnalyticsRoomId({
    pathname: pageViewInput.pathname,
    currentRoomId,
    sessionReady,
    userId: confirmedUserId,
  });
  // Missing/mismatched room context still belongs to MainRoomGate hydration.
  // A settled anonymous/error user can keep its baseline ungrouped page view.
  const awaitingRoom = isAnalyticsRoomPath(pageViewInput.pathname) &&
    !resolveSelectedAnalyticsRoomId({ pathname: pageViewInput.pathname, currentRoomId });
  const alreadyTracked =
    lastTrackedPathname === pageViewInput.pathname &&
    (!lastTrackedRoomId || !roomId || lastTrackedRoomId === roomId);
  return {
    userId: confirmedUserId,
    pageView:
      awaitingRoom || alreadyTracked
        ? null
        : {
            ...buildAnalyticsPageView(pageViewInput),
            ...(roomId ? { room_id: roomId } : {}),
          },
  };
}

export function executeSessionPageViewPlan(
  plan: SessionPageViewPlan,
  executor: SessionPageViewPlanExecutor,
): void {
  executor.setUserId(plan.userId);
  if (plan.pageView) {
    executor.trackPageView(plan.pageView);
  }
}
