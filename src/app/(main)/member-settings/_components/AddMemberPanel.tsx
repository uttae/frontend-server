"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useRegenerateInviteCode } from "@/hooks/useRooms";
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
  isRoomDetailLoading: boolean;
  isRoomDetailError: boolean;
  onClose: () => void;
};

function normalizeInviteCode(inviteCode: string | null | undefined): string {
  return typeof inviteCode === "string" ? inviteCode.trim() : "";
}

export function AddMemberPanel({
  roomId,
  inviteCode,
  memberCount,
  role,
  isRoomDetailLoading,
  isRoomDetailError,
  onClose,
}: Props) {
  const roomIdTrim = roomId.trim();
  const detailInviteCode = normalizeInviteCode(inviteCode);
  const [copied, setCopied] = useState(false);
  const [issuedCode, setIssuedCode] = useState<
    string | null | undefined
  >(undefined);
  // 개발 Strict Mode에서 effect가 재실행되어도 자동 발급은 방마다 한 번만 시도한다.
  const autoIssueAttemptedRoomRef = useRef<string | null>(null);

  const { mutate: regenerate, isPending: isRegenerating } =
    useRegenerateInviteCode();

  useEffect(() => {
    if (!roomIdTrim.length || isRoomDetailLoading) return;

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
    detailInviteCode,
    inviteCode,
    isRoomDetailError,
    isRoomDetailLoading,
    regenerate,
    roomIdTrim,
  ]);

  const displayedCode =
    issuedCode === undefined ? detailInviteCode || null : issuedCode;
  const inviteUrl = displayedCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${displayedCode}`
    : null;

  function handleCopy() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      trackAnalyticsEvent(AnalyticsEvents.sharePlan, {
        member_count_bucket:
          memberCount === undefined
            ? undefined
            : bucketMemberCount(memberCount),
        method: "copy_link",
        role: toAnalyticsRoomRole(role),
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleShare() {
    if (!inviteUrl) return;
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
    handleCopy();
    toast.info("공유 시트를 열 수 없어 링크를 복사했어요.");
  }

  function handleRegenerate() {
    if (!roomIdTrim.length) return;
    setIssuedCode(null);
    regenerate(roomIdTrim, {
      onSuccess: ({ inviteCode: newCode }) => {
        setIssuedCode(newCode);
      },
      onError: () => {
        toast.error("초대 링크를 재발급하지 못했어요.");
      },
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-border bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-border bg-white px-4 py-3">
        <span className="text-[17px] font-semibold text-gray-800">멤버 초대</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-dark-gray transition-colors hover:bg-gray-100"
          aria-label="닫기"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-[14px] text-dark-gray">
          아래 초대 링크를 복사해 멤버를 초대하세요.
        </p>

        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-gray-border bg-white px-3 py-2">
            {inviteUrl ? (
              <span className="truncate text-[14px] text-dark-gray">
                {inviteUrl}
              </span>
            ) : (
              <span className="truncate text-[14px] text-light-gray">
                {isRoomDetailLoading
                  ? "방 정보를 불러오는 중…"
                  : isRegenerating
                    ? "초대 링크를 발급하는 중…"
                    : isRoomDetailError || inviteCode === undefined
                      ? "방 정보를 불러오지 못했어요. 아래에서 재발급을 눌러 주세요."
                      : "발급에 실패했어요. 아래에서 재발급을 눌러 주세요."}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!inviteUrl}
            className={`flex-shrink-0 cursor-pointer rounded-lg border px-3 py-2 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              copied
                ? "border-status-positive bg-status-positive/10 text-status-positive"
                : "border-gray-border bg-white text-dark-gray hover:border-gray-400"
            }`}
          >
            {copied ? "복사됨 ✓" : "복사"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={!inviteUrl}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Share2 size={16} strokeWidth={2.2} aria-hidden />
          친구에게 공유
        </button>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex cursor-pointer items-center gap-1.5 self-start text-[14px] text-dark-gray transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw
            size={12}
            className={isRegenerating ? "animate-spin" : ""}
          />
          {isRegenerating ? "재발급 중…" : "초대 링크 재발급"}
        </button>
      </div>
    </div>
  );
}
