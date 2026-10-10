"use client";

import { usePathname } from "next/navigation";
import { useSessionUser } from "@/hooks/useSessionUser";
import { resolveAnalyticsRoomId } from "@/lib/analytics/room-context";
import { useSessionStore } from "@/stores/session-store";

/** Observe the existing session context; never fetch a room for analytics. */
export function useAnalyticsRoomId(): string | undefined {
  const pathname = usePathname();
  const currentRoomId = useSessionStore((state) => state.currentRoomId);
  const sessionReady = useSessionStore((state) => state.sessionReady);
  const { data: user, status } = useSessionUser();
  return resolveAnalyticsRoomId({
    pathname,
    currentRoomId,
    sessionReady,
    userId: status === "success" ? user?.id : undefined,
  });
}
