import type { QueryClient } from "@tanstack/react-query";

import { sessionUserQueryKey } from "@/lib/query-keys";
import type { SessionUser } from "@/lib/session-user";

export function readSessionUserCache(queryClient: QueryClient): SessionUser | null | undefined {
  return queryClient.getQueryData<SessionUser | null>(sessionUserQueryKey);
}

export function setSessionUserCache(queryClient: QueryClient, user: SessionUser | null): void {
  queryClient.setQueryData(sessionUserQueryKey, user);
}

export function readSessionUserId(queryClient: QueryClient): number | undefined {
  const user = readSessionUserCache(queryClient);
  return user?.id;
}
