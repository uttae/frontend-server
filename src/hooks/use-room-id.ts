"use client";

import { useLayoutEffect } from "react";
import { useClientReady } from "./useClientReady";
import { usePathname } from "next/navigation";

import { parseRoomContextPath } from "@/lib/room-context-path";
import {
  resolveCurrentRoomId,
  resolveRoomIdFromStoreAndUrl,
} from "@/lib/session-room-storage";
import {
  bootstrapCurrentRoomFromSessionStorage,
  useSessionStore,
} from "@/stores/session-store";

export function useResolvedCurrentRoomId(urlRoomId?: string | null) {
  const pathname = usePathname();
  const route = parseRoomContextPath(pathname);
  const explicitRoomId = route.roomId ?? urlRoomId;
  const currentRoomId = useSessionStore((s) => s.currentRoomId);
  const ssrSafeRoomId = resolveRoomIdFromStoreAndUrl(
    currentRoomId,
    explicitRoomId,
  );

  const roomContextReady = useClientReady();
  const effectiveRoomId = route.invalidPackingPath ? null : roomContextReady
    ? resolveCurrentRoomId(currentRoomId, explicitRoomId)
    : ssrSafeRoomId;

  useLayoutEffect(() => {
    if (route.invalidPackingPath) return;
    bootstrapCurrentRoomFromSessionStorage(pathname);
    if (effectiveRoomId && useSessionStore.getState().currentRoomId !== effectiveRoomId) {
      useSessionStore.getState().setCurrentRoomId(effectiveRoomId);
    }
  }, [effectiveRoomId, pathname, route.invalidPackingPath]);

  return { effectiveRoomId, roomContextReady };
}

export function useCurrentRoomId() {
  const pathname = usePathname();
  const { roomId: roomIdFromUrl } = parseRoomContextPath(pathname);
  const { effectiveRoomId, roomContextReady } =
    useResolvedCurrentRoomId(roomIdFromUrl);

  return {
    roomId: effectiveRoomId,
    roomContextReady,
  };
}
