"use client";

import {
  useApproveJoinRequest,
  useJoinRequests,
  useRejectJoinRequest,
} from "@/hooks/useRooms";
import { toast } from "sonner";

import { UserAvatar } from "@/components/user/UserAvatar";
import type { JoinRequest } from "@/lib/api/rooms";

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
  const variables = { roomId, requestId: request.requestId };

  function handleReject() {
    reject(variables, {
      onSuccess: () => toast.success(`${request.nickname}님의 참여 요청을 거절했어요.`),
      onError: () => toast.error("참여 요청을 거절하지 못했어요. 다시 시도해 주세요."),
    });
  }

  function handleApprove() {
    approve(variables, {
      onSuccess: () => toast.success(`${request.nickname}님의 참여를 승인했어요.`),
      onError: () => toast.error("참여 요청을 승인하지 못했어요. 다시 시도해 주세요."),
    });
  }

  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        user={request}
        size={36}
        className="bg-primary-subtle"
        initialClassName="font-medium text-primary"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-body-m-regular font-medium mobile:text-body-s-regular text-text">
          {request.nickname}
        </p>
        <p className="text-caption-m-regular text-text-subtle">
          {formatRelativeTime(request.requestedAt)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          aria-label={`${request.nickname} 참여 거절`}
          className="h-8 cursor-pointer rounded-lg border border-border bg-fill-subtle px-3.5 text-label-m-emphasis text-text transition-colors enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
        >
          거절
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          aria-label={`${request.nickname} 참여 승인`}
          className="h-8 cursor-pointer rounded-lg bg-primary px-3.5 text-label-m-emphasis text-text-inverse transition-colors enabled:hover:bg-primary-strong disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
        >
          승인
        </button>
      </div>
    </div>
  );
}

export function JoinRequestsSection({ roomId }: Props) {
  const { data } = useJoinRequests(roomId);
  const requests = data?.requests ?? [];

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <section aria-label="참여 요청" className="flex flex-col gap-3">
        <h2 className="flex items-baseline gap-2 text-title-s text-text">
          <span>참여 요청</span>
          <span className="text-body-m-regular font-medium text-primary">{requests.length}</span>
        </h2>
        <div className="flex flex-col gap-4">
          {requests.map((req) => (
            <JoinRequestCard key={req.requestId} request={req} roomId={roomId} />
          ))}
        </div>
      </section>
      <hr className="border-border-subtle" />
    </>
  );
}
