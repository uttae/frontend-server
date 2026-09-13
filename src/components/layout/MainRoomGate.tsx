"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect } from "react";

import { ExpenseProvider } from "@/components/expenses/ExpenseProvider";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { invalidateRoomUnreadCount } from "@/lib/chat/message-read";
import { beginExpenseRoomAdmission } from "@/lib/expenses/expense-recovery";
import { useSessionUser } from "@/hooks/useSessionUser";
import { validateRoomAccess } from "@/lib/rooms";
import { useChatPanelOpen } from "@/hooks/useChatPanelOpen";
import { useSessionStore } from "@/stores/session-store";

function RoomUnreadCountSync({ roomId }: { roomId: string }) {
  const queryClient = useQueryClient();
  const chatPanelOpen = useChatPanelOpen();

  useEffect(() => {
    if (!chatPanelOpen) invalidateRoomUnreadCount(queryClient, roomId);
  }, [roomId, chatPanelOpen, queryClient]);

  return null;
}

/**
 * 인증은 미들웨어(`GET /api/auth/session` → HttpOnly 쿠키 검증)에서 처리합니다.
 * (main) 안에서는 선택된 방이 없으면 `/home`으로 보냅니다.
 *
 * `currentRoomId`는 sessionStorage(탭) + `/plan/[roomId]` URL.
 * 프로필(`user`)은 `reconcileClientSession`(`users/me`)으로 메모리에만 둡니다.
 */
export function MainRoomGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionReady = useSessionStore((s) => s.sessionReady);
  const { data: user } = useSessionUser();
  const { roomId, roomContextReady } = useCurrentRoomId();

  useEffect(() => {
    if (!roomContextReady || !roomId || !sessionReady || !user?.id) return;

    const confirm = beginExpenseRoomAdmission(queryClient);
    let cancelled = false;
    void (async () => {
      const verdict = await validateRoomAccess(roomId);
      if (cancelled) return;
      confirm(roomId, verdict === "ok");
      if (verdict !== "forbidden") return;
      const session = useSessionStore.getState();
      session.clearCurrentRoomId();
      router.replace("/home");
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, roomContextReady, router, queryClient, sessionReady, user?.id]);

  useEffect(() => {
    if (!roomContextReady || roomId) return;
    router.replace("/home");
  }, [roomId, roomContextReady, router]);

  if (!roomContextReady || !roomId) {
    return null;
  }

  return (
    <>
      <Suspense fallback={null}>
        <RoomUnreadCountSync roomId={roomId} />
      </Suspense>
      <ExpenseProvider key={roomId} roomId={roomId}>
        {children}
      </ExpenseProvider>
    </>
  );
}
