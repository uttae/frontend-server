import type { QueryClient } from "@tanstack/react-query";

import {
  isProtectedAppPath,
  shouldSkipReconcileClientSession,
} from "@/lib/auth-session";
import { clearUserScopedBrowserStorage, tearDownClientSession } from "@/lib/client-storage";
import {
  fetchSessionUserRaw,
  fetchSessionUserResult,
  fetchSessionUserWithRetry,
} from "@/lib/session-user";
import {
  readSessionUserCache,
  setSessionUserCache,
} from "@/lib/session-user-cache";
import { useSessionStore } from "@/stores/session-store";

export type { SessionUser } from "@/lib/session-user";
export {
  checkClientAuthenticated,
  consumePendingInviteCode,
  setPendingInviteCode,
} from "@/lib/session-user-flow";
export {
  fetchSessionUserRaw,
  fetchSessionUserResult,
  fetchSessionUserWithRetry,
};
export type { FetchSessionUserResult } from "@/lib/session-user";

export async function reconcileClientSession(
  queryClient: QueryClient,
): Promise<void> {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;
  if (shouldSkipReconcileClientSession(path)) return;

  useSessionStore.getState().setSessionReady(false);

  try {
    const prevUser = readSessionUserCache(queryClient);
    const result = await fetchSessionUserResult();

    if (result.kind === "user") {
      const user = result.user;
      if (prevUser != null && prevUser.id !== user.id) {
        clearUserScopedBrowserStorage();
        useSessionStore.getState().clearSessionRoomContext();
        setSessionUserCache(queryClient, null);
      }
      setSessionUserCache(queryClient, user);
      return;
    }

    if (result.kind === "network_error") {
      return;
    }

    tearDownClientSession({ queryClient });
    if (isProtectedAppPath(path)) {
      window.location.replace("/login");
    }
  } finally {
    useSessionStore.getState().setSessionReady(true);
  }
}
