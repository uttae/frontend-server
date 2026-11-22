"use client";

import { useQuery } from "@tanstack/react-query";

import { sessionUserQueryKey } from "@/lib/query-keys";
import { fetchSessionUserRaw } from "@/lib/session-user";
import { readSessionUserCache, readSessionUserId, setSessionUserCache } from "@/lib/session-user-cache";
import { useSessionStore } from "@/stores/session-store";

export type { SessionUser } from "@/lib/session-user";
export { readSessionUserCache, readSessionUserId, setSessionUserCache };

export function useSessionUser() {
  const sessionReady = useSessionStore((s) => s.sessionReady);

  return useQuery({
    queryKey: sessionUserQueryKey,
    queryFn: fetchSessionUserRaw,
    enabled: sessionReady,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
