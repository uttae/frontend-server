"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { LoadingIndicator } from "@/components/loading/LoadingIndicator";

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-fill-elevate px-4 py-12">
      <BrandLogo variant="symbol" size="S" alt="우때 로고" />

      <div className="flex w-full max-w-[480px] flex-col gap-6 rounded-xl bg-fill-elevate p-6 shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
        <span
          className={`self-start rounded p-1 text-label-xs-regular ${
            isRejected ? "bg-fill text-text-subtle" : "bg-primary-subtle text-primary"
          }`}
        >
          {isRejected ? "참여 거절" : "승인 대기"}
        </span>

        <h1 className="text-title-l text-text">
          {isRejected ? "참여 요청이 거절됐어요" : "참여 요청을 보냈어요"}
        </h1>

        <p className="break-words text-title-m text-text">{roomTitle}</p>

        <p className="whitespace-pre-line text-body-m-regular mobile:text-body-s-regular text-text-subtle">
          {isRejected
            ? "방장이 참여 요청을 거절했어요."
            : "방장의 승인을 기다리고 있어요.\n승인 상태를 확인하면 여행 일정으로 이동해요."}
        </p>

        {fetchError && (
          <p role="alert" className="text-body-s-regular text-status-negative">
            상태를 확인하지 못했어요. 다시 시도해 주세요.
          </p>
        )}

        {isRejected ? (
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="h-12 w-full cursor-pointer rounded-lg bg-primary text-label-l-emphasis text-text-inverse transition-colors hover:bg-primary-strong"
          >
            홈으로 돌아가기
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            aria-busy={isChecking}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-primary text-label-l-emphasis text-text-inverse transition-colors enabled:hover:bg-primary-strong disabled:cursor-not-allowed"
          >
            {isChecking ? <LoadingIndicator label="승인 상태 확인 중" className="text-text-inverse" /> : "승인 상태 확인"}
          </button>
        )}
      </div>

      {!isRejected && (
        <p className="w-full max-w-[480px] text-body-s-regular text-text-subtle">
          페이지를 닫아도 요청은 유지돼요.
        </p>
      )}
    </div>
  );
}

export default function WaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-fill-elevate">
          <LoadingIndicator label="승인 대기 화면 준비 중" size={32} />
        </div>
      }
    >
      <WaitingContent />
    </Suspense>
  );
}
