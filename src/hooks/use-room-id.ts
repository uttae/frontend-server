"use client";

import { useLayoutEffect } from "react";
import { useClientReady } from "./useClientReady";
import { usePathname } from "next/navigation";

import { roomIdFromPlanPathname } from "@/lib/plan-room-path";
import {
  resolveCurrentRoomId,
  resolveRoomIdFromStoreAndUrl,
} from "@/lib/session-room-storage";
import {
  bootstrapCurrentRoomFromSessionStorage,
  useSessionStore,
} from "@/stores/session-store";

/**
 * 방 ID 해석 — hydration 안전.
 * 첫 페인트(SSR·클라이언트 hydration)는 URL·Zustand만 사용하고,
 * hydration 이후 sessionStorage까지 반영합니다.
 */
export function useResolvedCurrentRoomId(urlRoomId?: string | null) {
  const currentRoomId = useSessionStore((s) => s.currentRoomId);
  const ssrSafeRoomId = resolveRoomIdFromStoreAndUrl(
    currentRoomId,
    urlRoomId,
  );

  const roomContextReady = useClientReady();
  const effectiveRoomId = roomContextReady
    ? resolveCurrentRoomId(currentRoomId, urlRoomId)
    : ssrSafeRoomId;

  useLayoutEffect(() => {
    bootstrapCurrentRoomFromSessionStorage();
    if (effectiveRoomId && useSessionStore.getState().currentRoomId !== effectiveRoomId) {
      useSessionStore.getState().setCurrentRoomId(effectiveRoomId);
    }
  }, [effectiveRoomId]);

  return { effectiveRoomId, roomContextReady };
}

/** pathname·sessionStorage·Zustand를 통합한 현재 방 ID */
export function useCurrentRoomId() {
  const pathname = usePathname();
  const planRoomIdFromUrl = roomIdFromPlanPathname(pathname);
  const { effectiveRoomId, roomContextReady } =
    useResolvedCurrentRoomId(planRoomIdFromUrl);

  return {
    roomId: effectiveRoomId,
    roomContextReady,
  };
}
