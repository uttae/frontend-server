"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RefreshCw } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";

import { useCheckJoinStatus } from "@/hooks/useRooms";
import { getRoomDetail, HttpError } from "@/lib/api/rooms";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import {
  completeWaitingJoinApproval,
  joinStatusForWaitingUi,
} from "@/lib/join-room-workflow";
import { roomDetailQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";

type WaitingCheckState = ReturnType<typeof joinStatusForWaitingUi> | null;

function WaitingContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const roomId = searchParams.get("roomId") ?? "";
  const roomTitle = searchParams.get("roomTitle") ?? "여행 방";

  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);

  const [statusResult, setStatusResult] = useState<WaitingCheckState>(null);
  const [fetchError, setFetchError] = useState(false);

  const { mutate: checkStatus, isPending: isChecking } = useCheckJoinStatus();

  function handleRefresh() {
    if (!roomId) return;
    setFetchError(false);

    checkStatus(roomId, {
      onSuccess: async (data) => {
        const uiStatus = joinStatusForWaitingUi(data);
        setStatusResult(uiStatus);
        if (uiStatus === "APPROVED") {
          await completeWaitingJoinApproval(data, {
            setCurrentRoomId,
            getRoomDetail,
            cacheRoomDetail: (id, detail) => {
              queryClient.setQueryData(roomDetailQueryKey(id), detail);
            },
            trackAnalyticsEvent,
            navigateToPlan: router.replace,
          });
        }
      },
      onError: (err) => {
        // 404 → 거절된 상태로 처리 (서버가 요청 삭제 후 not found 반환)
        if (err instanceof HttpError && err.status === 404) {
          setStatusResult("REJECTED");
        } else {
          setFetchError(true);
        }
      },
    });
  }

  const isRejected = statusResult === "REJECTED";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-gradient-to-b from-bubble-gray/60 via-white to-white px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(1,131,255,0.07),_transparent_55%)]"
        aria-hidden
      />

      <BrandLogo variant="combination" size="M" alt="우때 로고" />

      <div className="relative w-full max-w-sm rounded-3xl border border-gray-border bg-white/95 p-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.10)] backdrop-blur-sm">
        {/* 아이콘 */}
        <div className="mb-8 flex items-center justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {!isRejected && (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20" />
                <span className="absolute inline-flex h-16 w-16 animate-ping rounded-full bg-primary/15 [animation-delay:0.4s]" />
              </>
            )}
            <div
              className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
                isRejected ? "bg-gray-100" : "bg-primary/10"
              }`}
            >
              {isRejected ? (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-dark-gray"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6M9 9l6 6" />
                </svg>
              ) : (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* 텍스트 */}
        <div className="mb-6 text-center">
          {isRejected ? (
            <>
              <h1 className="mb-2 text-[22px] font-semibold text-gray-800">
                입장이 거절되었습니다
              </h1>
              <p className="text-[17px] leading-relaxed text-dark-gray">
                방장이 입장 요청을 거절했습니다.
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-2 text-[22px] font-semibold text-gray-800">
                입장 승인 대기 중
              </h1>
              <p className="text-[17px] leading-relaxed text-dark-gray">
                <span className="font-medium text-gray-800">{roomTitle}</span>{" "}
                방의 방장이 입장 요청을 확인 중입니다.
                <br />
                승인되면 새로고침시 방으로 이동됩니다.
              </p>
            </>
          )}
        </div>

        {/* 오류 */}
        {fetchError && (
          <p className="mb-4 rounded-xl bg-status-negative/10 px-4 py-2.5 text-center text-[14px] text-status-negative">
            상태 조회에 실패했습니다. 다시 시도해 주세요.
          </p>
        )}

        {/* 새로고침 버튼 (대기·오류 상태에서 항상 표시) */}
        {!isRejected && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-dark-gray transition-colors hover:border-gray-400 hover:text-black disabled:opacity-50"
          >
            <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
            {isChecking ? "확인 중…" : "입장 상태 새로고침"}
          </button>
        )}

        {/* 거절 시 홈으로 */}
        {isRejected && (
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="w-full rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-dark-gray transition-colors hover:border-gray-400 hover:text-black"
          >
            홈으로 돌아가기
          </button>
        )}
      </div>

      {!isRejected && (
        <p className="relative text-[14px] text-light-gray">
          페이지를 닫아도 승인 후에 로그인하면 참가 완료됩니다.
        </p>
      )}
    </div>
  );
}

export default function WaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bubble-gray/80 via-white to-white">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
        </div>
      }
    >
      <WaitingContent />
    </Suspense>
  );
}
