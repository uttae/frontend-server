import type { QueryClient } from "@tanstack/react-query";

import { analyticsEntryPoint } from "@/lib/analytics/context";
import {
  AnalyticsEvents,
  setAnalyticsUserId,
  trackAnalyticsEvent,
} from "@/lib/analytics/track";
import {
  consumePendingInviteCode,
  fetchSessionUserWithRetry,
} from "@/lib/auth";
import { tearDownClientSession } from "@/lib/client-storage";
import {
  clearGoogleAgreementFlowSession,
  readGoogleAgreementFlowSession,
} from "@/lib/google-oauth";
import { pendingInviteReturnPath } from "@/lib/session-user-flow";
import { setSessionUserCache } from "@/lib/session-user-cache";
import { useSessionStore } from "@/stores/session-store";

/** 쿠키 발급 후 클라이언트 세션을 동기화하고 최종 이동 경로를 반환합니다. */
export async function finishGoogleLogin(
  queryClient: QueryClient,
): Promise<string | null> {
  const me = await fetchSessionUserWithRetry();
  if (!me) {
    tearDownClientSession({ queryClient });
    useSessionStore.getState().setSessionReady(true);
    return null;
  }

  setSessionUserCache(queryClient, me);
  useSessionStore.getState().setSessionReady(true);
  const agreementFlow = readGoogleAgreementFlowSession();
  const inviteDestination = pendingInviteReturnPath();
  const pendingInviteCode = consumePendingInviteCode();
  clearGoogleAgreementFlowSession();
  setAnalyticsUserId(me.id);
  trackAnalyticsEvent(
    agreementFlow?.kind === "signup"
      ? AnalyticsEvents.signUp
      : AnalyticsEvents.login,
    {
      method: "google",
      entry_point: analyticsEntryPoint(pendingInviteCode),
    },
  );

  return inviteDestination ?? "/home";
}
