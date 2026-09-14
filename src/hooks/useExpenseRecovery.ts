"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStompContext } from "@/contexts/StompContext";
import { getExpenseRecovery } from "@/lib/expenses/expense-recovery";

export function useExpenseRecovery(roomId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const recovery = useMemo(
    () => getExpenseRecovery(queryClient, roomId),
    [queryClient, roomId],
  );
  const status = useSyncExternalStore(
    recovery.subscribe,
    recovery.getSnapshot,
    recovery.getSnapshot,
  );
  const { client, connected } = useStompContext();
  const revoked = status === "revoked";
  useEffect(() => {
    if (!enabled || revoked) return;
    const run = () => {
      void recovery.refresh("all").catch(() => {});
    };
    const subscription =
      connected && client
        ? client.subscribe(`/topic/rooms/${roomId}/expenses`, (frame) => {
            void recovery.message(frame.body).catch(() => {});
          })
        : null;
    // Entry, connect/reconnect and every subscription starts a full read.
    run();
    return () => {
      subscription?.unsubscribe();
    };
  }, [client, connected, enabled, recovery, revoked, roomId]);
  useEffect(() => {
    if (!enabled || revoked || typeof document === "undefined") return;
    const recoverVisible = () => {
      if (document.visibilityState === "visible")
        void recovery.refresh("visible").catch(() => {});
    };
    document.addEventListener("visibilitychange", recoverVisible);
    window.addEventListener("focus", recoverVisible);
    return () => {
      document.removeEventListener("visibilitychange", recoverVisible);
      window.removeEventListener("focus", recoverVisible);
    };
  }, [enabled, recovery, revoked]);
  return {
    recovery,
    revoked,
    syncStatus: revoked ? "revoked" : !connected ? "disconnected" : status,
  };
}
