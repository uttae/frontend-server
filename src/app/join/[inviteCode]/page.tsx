"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";

import { checkClientAuthenticated, setPendingInviteCode } from "@/lib/auth";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { useJoinRoom } from "@/hooks/useRooms";
import { getRoomDetail } from "@/lib/api/rooms";
import { buildJoinPlanAnalyticsParams, planPathForRoom } from "@/lib/join-room-workflow";
import { roomDetailQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inviteCode = Array.isArray(params.inviteCode) ? params.inviteCode[0] : params.inviteCode;

  const [error, setError] = useState<string | null>(null);
  const lastTrackedInviteCodeRef = useRef<string | null>(null);

  const { mutate: join } = useJoinRoom();
  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);

  useEffect(() => {
    if (!inviteCode) return;
    if (lastTrackedInviteCodeRef.current !== inviteCode) {
      lastTrackedInviteCodeRef.current = inviteCode;
      trackAnalyticsEvent(AnalyticsEvents.inviteView, {
        entry_point: "invite",
      });
    }

    let cancelled = false;

    void (async () => {
      const authenticated = await checkClientAuthenticated();
      if (cancelled) return;

      if (!authenticated) {
        setPendingInviteCode(inviteCode);
        router.replace("/login");
        return;
      }

      join(inviteCode, {
        onSuccess: async (data) => {
          if (data.httpStatus === 200) {
            setCurrentRoomId(data.id);
            let memberCount: number | undefined;
            try {
              const meta = await getRoomDetail(data.id);
              memberCount = meta.memberCount;
              queryClient.setQueryData(roomDetailQueryKey(data.id), meta);
            } catch {
              // 메타 조회 실패해도 입장은 진행 (waiting 승인 처리와 동일)
            }
            trackAnalyticsEvent(
              AnalyticsEvents.joinPlan,
              buildJoinPlanAnalyticsParams(data.role, memberCount)
            );
            router.replace(planPathForRoom(data.id));
            return;
          }
          router.replace(
            `/waiting?roomId=${encodeURIComponent(data.id)}&roomTitle=${encodeURIComponent(data.roomTitle)}`
          );
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "입장 요청에 실패했습니다.");
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteCode, join, router, setCurrentRoomId, queryClient]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4">
        <BrandLogo variant="combination" size="M" alt="우때 로고" />
        <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="mb-1 font-semibold text-primary">입장 요청 실패</p>
          <p className="text-[17px] text-dark-gray">{error}</p>
        </div>
        <button
          onClick={() => router.replace("/home")}
          className="text-[17px] text-dark-gray underline underline-offset-4 hover:text-black"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4">
      <BrandLogo variant="combination" size="M" alt="우때 로고" />
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
      <p className="text-[17px] text-dark-gray">입장 요청 중…</p>
    </div>
  );
}
