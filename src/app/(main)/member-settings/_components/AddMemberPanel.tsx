"use client";

import { CopyCheckIcon, CopyIcon, RefreshIcon, ShareIcon } from "@/assets/icons";
import { LoadingIndicator } from "@/components/loading/LoadingIndicator";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useRegenerateInviteCode } from "@/hooks/useRooms";
import { isHostRole, isRoomMemberRole } from "@/lib/rooms";
import {
  bucketMemberCount,
  toAnalyticsRoomRole,
} from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";

type Props = {
  roomId: string;
  inviteCode: string | null | undefined;
  memberCount?: number;
  role?: string;
  /** 방장 여부를 이미 계산한 화면은 넘긴다 — 없으면 `role`로 판단 */
  isHost?: boolean;
  isRoomDetailLoading: boolean;
  isRoomDetailError: boolean;
  /** 안내 문구 — 모달처럼 바깥에서 본문으로 보여줄 때는 false */
  showDescription?: boolean;
};

function normalizeInviteCode(inviteCode: string | null | undefined): string {
  return typeof inviteCode === "string" ? inviteCode.trim() : "";
}

export function AddMemberPanel({
  roomId,
  inviteCode,
  memberCount,
  role,
  isHost,
  isRoomDetailLoading,
  isRoomDetailError,
  showDescription = true,
}: Props) {
  const roomIdTrim = roomId.trim();
  // 초대 코드 발급·재발급 API는 방장 전용 — 참여자는 서버가 내려준 코드가 있을 때만 링크를 보여준다
  const canShareInvite = isRoomMemberRole(role) && !isRoomDetailError;
  const canIssue = canShareInvite && (isHost ?? isHostRole(role));
  const detailInviteCode = normalizeInviteCode(inviteCode);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);
  const [issuedCode, setIssuedCode] = useState<
    string | null | undefined
  >(undefined);
  // 개발 Strict Mode에서 effect가 재실행되어도 자동 발급은 방마다 한 번만 시도한다.
  const autoIssueAttemptedRoomRef = useRef<string | null>(null);

  const { mutate: regenerate, isPending: isRegenerating } =
    useRegenerateInviteCode();

  useEffect(() => {
    if (!roomIdTrim.length || isRoomDetailLoading || !canIssue) return;

    if (detailInviteCode) return;

    if (
      isRoomDetailError ||
      inviteCode === undefined ||
      autoIssueAttemptedRoomRef.current === roomIdTrim
    ) {
      return;
    }

    autoIssueAttemptedRoomRef.current = roomIdTrim;

    regenerate(roomIdTrim, {
      onSuccess: ({ inviteCode: newCode }) => {
        setIssuedCode(newCode);
      },
      onError: () => {
        toast.error("초대 링크를 발급하지 못했어요.");
      },
    });
  }, [
    canIssue,
    detailInviteCode,
    inviteCode,
    isRoomDetailError,
    isRoomDetailLoading,
    regenerate,
    roomIdTrim,
  ]);

  const displayedCode =
    issuedCode === undefined ? detailInviteCode || null : issuedCode;
  const inviteUrl = canShareInvite && displayedCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${displayedCode}`
    : null;

  async function handleCopy() {
    if (!inviteUrl || isRegenerating) return false;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      trackAnalyticsEvent(AnalyticsEvents.sharePlan, {
        member_count_bucket:
          memberCount === undefined
            ? undefined
            : bucketMemberCount(memberCount),
        method: "copy_link",
        role: toAnalyticsRoomRole(role),
      });
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      toast.error("링크를 복사하지 못했어요. 초대 링크를 직접 선택해 복사해 주세요.");
      return false;
    }
  }

  async function handleShare() {
    if (!inviteUrl || isRegenerating) return;
    const canShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";
    if (canShare) {
      try {
        await navigator.share({
          title: "우때 여행 초대",
          url: inviteUrl,
        });
        trackAnalyticsEvent(AnalyticsEvents.sharePlan, {
          member_count_bucket:
            memberCount === undefined
              ? undefined
              : bucketMemberCount(memberCount),
          method: "native_share",
          role: toAnalyticsRoomRole(role),
        });
        return;
      } catch (err) {
        if ((err as Error | undefined)?.name === "AbortError") return;
      }
    }
    if (await handleCopy()) toast.info("공유 시트를 열 수 없어 링크를 복사했어요.");
  }

  function handleRegenerate() {
    if (!roomIdTrim.length || !canIssue || isRegenerating) return;
    setCopied(false);
    regenerate(roomIdTrim, {
      onSuccess: ({ inviteCode: newCode }) => {
        setIssuedCode(newCode);
      },
      onError: () => {
        toast.error("초대 링크를 재발급하지 못했어요.");
      },
    });
  }

  let inviteFallback = <span className="truncate text-body-s-regular mobile:text-body-xs-regular text-text-subtle">
    {!canIssue
      ? "초대 링크를 사용할 수 없어요. 방 정보를 다시 확인해 주세요."
      : isRoomDetailError || inviteCode === undefined
        ? "방 정보를 불러오지 못했어요. 아래에서 재발급을 눌러 주세요."
        : "발급에 실패했어요. 아래에서 재발급을 눌러 주세요."}
  </span>;
  if (isRoomDetailLoading || isRegenerating) {
    inviteFallback = <LoadingIndicator label={isRoomDetailLoading ? "방 정보 불러오는 중" : "초대 링크 발급 중"} />;
  }
  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3">
        {showDescription ? (
          <p className="text-body-s-regular mobile:text-body-xs-regular text-text-subtle">
            링크를 공유해 함께 여행을 계획해 보세요.
          </p>
        ) : null}

        <div className="flex h-12 min-w-0 items-center gap-1 rounded-lg border border-border bg-fill pl-3.5 pr-1.5">
          <div className="flex min-w-0 flex-1 items-center">
            {inviteUrl ? (
              <input aria-label="초대 링크" readOnly disabled={isRegenerating} value={inviteUrl} onFocus={(event) => event.currentTarget.select()} className="w-full min-w-0 truncate bg-transparent text-body-m-regular mobile:text-body-s-regular text-text-subtle outline-none disabled:opacity-40" />
            ) : inviteFallback}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!inviteUrl || isRegenerating}
            className={`flex h-9 flex-shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-label-m-regular transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              copied ? "text-status-positive" : "text-dark-gray enabled:hover:bg-fill-strong"
            }`}
          >
            {copied ? <CopyCheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? "복사됨" : "복사"}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!inviteUrl || isRegenerating}
            className="flex h-9 flex-shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-label-m-regular text-dark-gray transition-colors enabled:hover:bg-fill-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShareIcon size={16} />
            공유
          </button>
        </div>

        {canIssue ? (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex cursor-pointer items-center gap-1.5 self-start text-label-m-regular mobile:text-label-s-regular text-dark-gray transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshIcon size={12} className={isRegenerating ? "animate-spin motion-reduce:animate-none" : undefined} />
          {isRegenerating ? "재발급 중…" : "초대 링크 재발급"}
        </button>
        ) : null}
      </div>
    </div>
  );
}
