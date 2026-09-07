"use client";

import { CheckIcon, XIcon } from "lucide-react";

import {
  useApproveJoinRequest,
  useJoinRequests,
  useRejectJoinRequest,
} from "@/hooks/useRooms";
import type { JoinRequest } from "@/lib/api/rooms";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

type Props = {
  roomId: string;
};

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function JoinRequestCard({
  request,
  roomId,
}: {
  request: JoinRequest;
  roomId: string;
}) {
  const { mutate: approve, isPending: isApproving } = useApproveJoinRequest();
  const { mutate: reject, isPending: isRejecting } = useRejectJoinRequest();
  const isPending = isApproving || isRejecting;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3",
        MAIN_CARD_INNER_PADDING_X_CLASS,
      )}
    >
      {/* avatar */}
      <div className="relative flex-shrink-0">
        {request.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={request.profileImageUrl}
            alt={request.nickname}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[17px] font-semibold text-primary">
            {request.nickname.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-medium text-gray-800">
          {request.nickname}
        </p>
        <p className="text-[14px] text-dark-gray">
          {formatRelativeTime(request.requestedAt)}
        </p>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={() => approve({ roomId, requestId: request.requestId })}
          disabled={isPending}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="승인"
        >
          <CheckIcon size={14} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => reject({ roomId, requestId: request.requestId })}
          disabled={isPending}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-status-negative/30 bg-status-negative/10 text-status-negative transition-colors hover:bg-status-negative/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="거절"
        >
          <XIcon size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export function JoinRequestsSection({ roomId }: Props) {
  const { data, isLoading } = useJoinRequests(roomId);
  const requests = data?.requests ?? [];

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-[14px] font-semibold uppercase tracking-wide text-dark-gray">
          입장 요청
        </p>
        <div className="flex items-center justify-center rounded-xl border border-gray-border bg-white py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
        </div>
      </section>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-semibold uppercase tracking-wide text-dark-gray">
          입장 요청
        </p>
        <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold leading-none text-white">
          {requests.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-primary/20 bg-white shadow-sm">
        {requests.map((req, i) => (
          <div
            key={req.requestId}
            className={i < requests.length - 1 ? "border-b border-gray-border" : ""}
          >
            <JoinRequestCard request={req} roomId={roomId} />
          </div>
        ))}
      </div>
    </section>
  );
}
