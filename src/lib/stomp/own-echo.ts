import type { QueryClient } from "@tanstack/react-query";

import { readSessionUserId } from "@/lib/session-user-cache";
import { getTabId } from "@/lib/tab-id";

type ChangeOrigin = {
  actorUserId: number;
  originTabId?: string | null;
};

export function isOwnEcho(queryClient: QueryClient, event: ChangeOrigin): boolean {
  if (!event.originTabId || event.originTabId !== getTabId()) return false;
  const me = readSessionUserId(queryClient);
  return typeof me === "number" && me === event.actorUserId;
}
