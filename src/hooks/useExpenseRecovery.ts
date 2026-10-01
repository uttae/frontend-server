"use client";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
  const previousConnection = useRef<{
    recovery: typeof recovery;
    client: typeof client;
    connected: boolean;
  } | null>(null);
  useEffect(() => {
    if (!enabled || revoked) {
      previousConnection.current = null;
      return;
    }
    const previous = previousConnection.current;
    const entering = previous?.recovery !== recovery;
    const connectionEstablished = connected && client &&
      (!previous?.connected || previous.client !== client);
    previousConnection.current = { recovery, client, connected };
    const subscription =
      connected && client
        ? client.subscribe(`/topic/rooms/${roomId}/expenses`, (frame) => {
            void recovery.message(frame.body).catch(() => {});
          })
        : null;
    // Read on admission and after establishing a subscription to recover missed
    // broadcasts. Losing a connection is not a reason to start HTTP reads.
    if (entering || connectionEstablished) {
      void recovery.refresh("all").catch(() => {});
    }
    return () => {
      subscription?.unsubscribe();
    };
  }, [client, connected, enabled, recovery, revoked, roomId]);
  let syncStatus: typeof status | "disconnected" = status;
  if (revoked) syncStatus = "revoked";
  else if (!connected) syncStatus = "disconnected";
  return {
    recovery,
    revoked,
    syncStatus,
  };
}
