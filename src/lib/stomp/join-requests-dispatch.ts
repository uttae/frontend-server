"use client";

import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { joinRequestsQueryKey } from "@/lib/query-keys";

const HOST_JOIN_REQUEST_TOAST_MS = 4000;

/** 호스트 개인 큐 — 새 입장 요청 시 join-requests Query 무효화 + 알림 */
export function dispatchHostJoinRequestFromStomp(
  queryClient: QueryClient,
  roomId: string,
  nickname: string,
): void {
  const label = nickname.trim().length > 0 ? nickname.trim() : "새 멤버";
  toast.success(`${label}님이 입장을 요청했습니다`, {
    duration: HOST_JOIN_REQUEST_TOAST_MS,
  });

  const rid = roomId.trim();
  if (!rid.length) return;

  void queryClient.invalidateQueries({
    queryKey: joinRequestsQueryKey(rid),
  });
}
