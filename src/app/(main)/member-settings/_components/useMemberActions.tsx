"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { alertDialogButtonClass } from "@/components/settings/SettingsActionButton";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useCurrentRoomMembership } from "@/hooks/useCurrentRoomMembership";
import { showRoomLeftToast } from "@/lib/stomp/forced-room-exit-dispatch";
import { useKickMember, useLeaveRoom, useTransferHost } from "@/hooks/useRooms";
import type { RoomMember } from "@/lib/api/rooms";
import { useSessionStore } from "@/stores/session-store";

type LeaveDialog = "confirm" | "delegateFirst" | "alone" | null;

const LEAVE_ERROR = "방나가기 실패했습니다.. 다시 시도해 주세요.";
const TRANSFER_ERROR = "방장 위임을 실패했습니다. 다시 시도해 주세요.";
const KICK_ERROR = "강제 퇴장을 실패했습니다. 다시 시도해 주세요.";

/** 단일 확인 버튼 안내 다이얼로그 */
function NoticeDialog({
  title,
  description,
  actionLabel,
  onClose,
}: Readonly<{
  title: string;
  description: string;
  actionLabel: string;
  onClose: () => void;
}>) {
  return (
    <SettingsDialog title={title} onClose={onClose} appearance="alert" showCloseButton={false}>
      <p className="whitespace-pre-line text-body-l-regular text-text">{description}</p>
      <button type="button" className={`mt-4 w-full ${alertDialogButtonClass.neutral}`} onClick={onClose}>
        {actionLabel}
      </button>
    </SettingsDialog>
  );
}

/**
 * 구성원 관리 동작(방장 위임·강제 퇴장·방 나가기)과 확인 다이얼로그.
 * 헤더 드롭다운과 모바일 초대하기 페이지가 함께 쓴다 — 다이얼로그는 `dialogs`를 렌더한 쪽에 붙는다.
 */
export function useMemberActions() {
  const router = useRouter();
  const [leaveDialog, setLeaveDialog] = useState<LeaveDialog>(null);
  const [kickTarget, setKickTarget] = useState<RoomMember | null>(null);
  const [transferTarget, setTransferTarget] = useState<RoomMember | null>(null);
  /** 열려 있는 확인 다이얼로그의 실패 안내 — 다이얼로그를 열거나 다시 시도하면 지운다 */
  const [actionError, setActionError] = useState<string | null>(null);

  const membership = useCurrentRoomMembership();
  const { user, roomId, me, others, isHost, isMembersLoading } = membership;
  const clearCurrentRoomId = useSessionStore((s) => s.clearCurrentRoomId);

  const { mutate: kick, isPending: isKicking } = useKickMember();
  const { mutateAsync: leaveAsync, isPending: isLeaving } = useLeaveRoom();
  const { mutate: transfer, isPending: isTransferring } = useTransferHost();
  const hostCannotLeaveAlone = Boolean(
    isHost && user && !isMembersLoading && others.length === 0,
  );
  /** 다른 멤버가 있으면 방장은 수동 위임 후에만 퇴장 가능 */
  const hostNeedsManualDelegation = Boolean(
    isHost && user && !isMembersLoading && others.length > 0,
  );

  async function handleLeaveRoom() {
    if (!roomId || !user) return;
    if (isHost && others.length > 0) {
      toast.error("먼저 방장을 위임해주세요.");
      return;
    }
    setActionError(null);
    try {
      await leaveAsync(roomId);
      showRoomLeftToast(roomId);
      clearCurrentRoomId();
      router.replace("/home");
    } catch {
      toast.error(LEAVE_ERROR);
      setActionError(LEAVE_ERROR);
    }
  }

  function openLeaveDialog() {
    setActionError(null);
    if (hostNeedsManualDelegation) setLeaveDialog("delegateFirst");
    else if (hostCannotLeaveAlone) setLeaveDialog("alone");
    else setLeaveDialog("confirm");
  }

  const dialogs = (
    <>
      {leaveDialog === "confirm" ? (
        <ConfirmDialog
          appearance="alert"
          destructive
          title="방에서 나가시겠어요?"
          description={"방을 나가면 이 여행의 일정과 대화에\n더 이상 접근할 수 없어요."}
          confirmLabel="나가기"
          isPending={isLeaving}
          errorMessage={actionError}
          onConfirm={() => void handleLeaveRoom()}
          onCancel={() => setLeaveDialog(null)}
        />
      ) : null}

      {leaveDialog === "delegateFirst" ? (
        <NoticeDialog
          title="먼저 방장을 위임해 주세요"
          description={"다른 참여자에게 방장을 넘긴 뒤\n방에서 나갈 수 있어요."}
          actionLabel="구성원으로 돌아가기"
          onClose={() => setLeaveDialog(null)}
        />
      ) : null}

      {leaveDialog === "alone" ? (
        <NoticeDialog
          title="방에서 나갈 수 없어요"
          description={"다른 구성원이 없으면 방장을 넘길 수 없어요.\n여행 정보 수정에서 여행을 삭제할 수 있어요."}
          actionLabel="확인"
          onClose={() => setLeaveDialog(null)}
        />
      ) : null}

      {transferTarget && roomId ? (
        <ConfirmDialog
          appearance="alert"
          title="방장을 위임하시겠어요?"
          description={`${transferTarget.nickname}님에게 방장을 넘기면\n나는 참여자가 돼요.`}
          confirmLabel="위임"
          isPending={isTransferring}
          errorMessage={actionError}
          onConfirm={() => {
            setActionError(null);
            transfer(
              { roomId, targetUserId: transferTarget.userId },
              {
                onSuccess: () => {
                  toast.success(`${transferTarget.nickname}님에게 방장을 위임했어요.`);
                  setTransferTarget(null);
                },
                onError: () => {
                  toast.error(TRANSFER_ERROR);
                  setActionError(TRANSFER_ERROR);
                },
              },
            );
          }}
          onCancel={() => setTransferTarget(null)}
        />
      ) : null}

      {kickTarget && roomId ? (
        <ConfirmDialog
          appearance="alert"
          destructive
          title="강제 퇴장하시겠어요?"
          description={`${kickTarget.nickname}님을 이 여행에서 내보내요.`}
          confirmLabel="강제 퇴장"
          isPending={isKicking}
          errorMessage={actionError}
          onConfirm={() => {
            setActionError(null);
            kick(
              { roomId, userId: kickTarget.userId },
              {
                onSuccess: () => {
                  toast.success(`${kickTarget.nickname}님을 내보냈어요.`);
                  setKickTarget(null);
                },
                onError: () => {
                  toast.error(KICK_ERROR);
                  setActionError(KICK_ERROR);
                },
              },
            );
          }}
          onCancel={() => setKickTarget(null)}
        />
      ) : null}
    </>
  );

  return {
    ...membership,
    memberCount: (me ? 1 : 0) + others.length,
    leaveDisabled: isHost && isMembersLoading,
    openLeaveDialog,
    requestKick: (member: RoomMember) => {
      setActionError(null);
      setKickTarget(member);
    },
    requestTransfer: (member: RoomMember) => {
      setActionError(null);
      setTransferTarget(member);
    },
    dialogs,
  };
}
