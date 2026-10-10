import type { QueryClient } from "@tanstack/react-query";

import { setAnalyticsUserId } from "@/lib/analytics/track";
import { resetAmplitudeIdentityOnLogout } from "@/lib/analytics/amplitude";
import { getQueryClient } from "@/lib/query-client";
import { readSessionUserId, setSessionUserCache } from "@/lib/session-user-cache";
import { clearCurrentRoomIdSessionStorage } from "@/lib/session-room-storage";
import { useSessionStore } from "@/stores/session-store";

/**
 * 로그아웃·세션 무효·계정 전환 시 사용자/방 관련 sessionStorage·레거시 localStorage 정리.
 */
export function clearUserScopedBrowserStorage(): void {
  if (typeof window === "undefined") return;

  const PLAN_ROUTE_PREFIX = "hau:plan:route:v1:";
  const PLAN_TRAVEL_MODE_PREFIX = "hau:plan:travelMode:v1:";
  const LEGACY_SESSION_PERSIST_KEY = "hau:session";

  function removeStorageKeysMatching(
    storage: Storage,
    predicate: (key: string) => boolean,
  ): void {
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && predicate(k)) toRemove.push(k);
    }
    for (const k of toRemove) {
      try {
        storage.removeItem(k);
      } catch {
        /* quota / private mode */
      }
    }
  }

  removeStorageKeysMatching(sessionStorage, (k) =>
    k.startsWith(PLAN_ROUTE_PREFIX) || k.startsWith(PLAN_TRAVEL_MODE_PREFIX),
  );

  removeStorageKeysMatching(
    localStorage,
    (k) =>
      k.startsWith(PLAN_ROUTE_PREFIX) ||
      k.startsWith(PLAN_TRAVEL_MODE_PREFIX) ||
      k === LEGACY_SESSION_PERSIST_KEY,
  );
}

/** HttpOnly는 `/api/auth/logout` — 클라이언트 방 포인터·session user Query 정리 */
export function tearDownClientSession(options?: {
  queryClient?: QueryClient;
}): void {
  const queryClient = options?.queryClient ?? getQueryClient();
  if (queryClient && readSessionUserId(queryClient) !== undefined) {
    resetAmplitudeIdentityOnLogout();
  }
  setAnalyticsUserId(null);
  clearCurrentRoomIdSessionStorage();
  useSessionStore.getState().clearSessionRoomContext();
  clearUserScopedBrowserStorage();
  if (queryClient) {
    setSessionUserCache(queryClient, null);
  }
}
