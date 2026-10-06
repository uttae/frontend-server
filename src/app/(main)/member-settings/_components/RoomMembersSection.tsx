"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { SettingsActionButton } from "@/components/settings/SettingsActionButton";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useCurrentRoomMembership } from "@/hooks/useCurrentRoomMembership";
import { useKickMember, useLeaveRoom, useTransferHost } from "@/hooks/useRooms";
import type { RoomMember } from "@/lib/api/rooms";
import { useSessionStore } from "@/stores/session-store";
import { AddMemberPanel } from "./AddMemberPanel";
import { JoinRequestsSection } from "./JoinRequestsSection";
import { MemberCard, type MemberCardData } from "./MemberCard";

function toMemberCardData(
  member: RoomMember,
  isCurrentUser: boolean,
): MemberCardData {
  const isLeft = member.status === "LEFT";
  return {
    id: String(member.userId),
    name: member.nickname,
    profileImageUrl: member.profileImageUrl,
    role: member.role,
    status: member.status,
    isCurrentUser,
    // 화면을 보고 있는 본인은 접속 중으로 표시한다
    connectionStatus: isLeft
      ? undefined
      : isCurrentUser || member.isOnline
        ? "online"
        : "offline",
  };
}

type LeaveDialog = "confirm" | "delegateFirst" | "alone" | null;

/** 단일 확인 버튼 안내 다이얼로그 */
function NoticeDialog({
  title,
  description,
  actionLabel,
  onClose,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClose: () => void;
}) {
  return (
    <SettingsDialog title={title} onClose={onClose} size="compact" appearance="ledger">
      <p className="whitespace-pre-line text-[14px] leading-5 text-text-subtle">{description}</p>
      <SettingsActionButton
        variant="primary"
        flex={false}
        className="mt-6 h-12 w-full rounded-lg text-[16px]"
        onClick={onClose}
      >
        {actionLabel}
      </SettingsActionButton>
    </SettingsDialog>
  );
}

export function RoomMembersSection() {
  const router = useRouter();
  const [leaveDialog, setLeaveDialog] = useState<LeaveDialog>(null);
  const [kickTarget, setKickTarget] = useState<RoomMember | null>(null);
  const [transferTarget, setTransferTarget] = useState<RoomMember | null>(null);

  const {
    user,
    roomId: currentRoomId,
    me,
    others,
    leftOthers,
    isHost,
    roomDetail,
    isDetailLoading,
    isDetailError,
    isMembersLoading,
  } = useCurrentRoomMembership();
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
  const memberCount = (me ? 1 : 0) + others.length;

  function finishLeaveSession() {
    clearCurrentRoomId();
    router.replace("/home");
  }

  async function handleLeaveRoom() {
    if (!currentRoomId || !user) return;
    if (isHost && others.length > 0) {
      toast.error("먼저 방장을 위임해주세요.");
      return;
    }
    try {
      await leaveAsync(currentRoomId);
      finishLeaveSession();
    } catch {
      // useHttpError / 글로벌 처리 또는 서버 메시지
    }
  }

  function openLeaveDialog() {
    if (hostNeedsManualDelegation) setLeaveDialog("delegateFirst");
    else if (hostCannotLeaveAlone) setLeaveDialog("alone");
    else setLeaveDialog("confirm");
  }

  return (
    <div className="flex flex-col gap-4">
      <MainPageHeader title="초대하기" />

      {currentRoomId && (
        <AddMemberPanel
          key={currentRoomId}
          roomId={currentRoomId}
          inviteCode={roomDetail?.inviteCode}
          memberCount={roomDetail?.memberCount}
          role={roomDetail?.role}
          isHost={isHost}
          isRoomDetailLoading={isDetailLoading}
          isRoomDetailError={isDetailError}
        />
      )}

      <hr className="border-border-subtle" />

      {isHost && currentRoomId ? <JoinRequestsSection roomId={currentRoomId} /> : null}

      <section aria-label="구성원" className="flex flex-col gap-2">
        <h2 className="flex items-baseline gap-2 text-title-s text-text">
          구성원
          {!isMembersLoading ? (
            <span className="text-body-m-regular font-medium text-primary">{memberCount}</span>
          ) : null}
        </h2>
        {isMembersLoading ? (
          <LoadingIndicator label="구성원 불러오는 중" className="flex min-h-36 w-full" />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {me ? (
              <li>
                <MemberCard
                  member={toMemberCardData(me, true)}
                  isViewerHost={isHost}
                  onKick={() => {}}
                  onTransfer={() => {}}
                />
              </li>
            ) : null}
            {others.map((member) => (
              <li key={member.userId}>
                <MemberCard
                  member={toMemberCardData(member, false)}
                  isViewerHost={isHost}
                  onKick={() => setKickTarget(member)}
                  onTransfer={() => setTransferTarget(member)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isMembersLoading && leftOthers.length > 0 && (
        <section aria-label="이전 구성원" className="flex flex-col gap-2">
          <h2 className="flex items-baseline gap-2 text-title-s text-text">
            이전 구성원
            <span className="text-body-m-regular font-medium text-primary">{leftOthers.length}</span>
          </h2>
          <ul className="flex flex-col divide-y divide-border-subtle">
            {leftOthers.map((member) => (
              <li key={member.userId}>
                <MemberCard
                  member={toMemberCardData(member, false)}
                  isViewerHost={isHost}
                  onKick={() => {}}
                  onTransfer={() => {}}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <hr className="border-border-subtle" />

      <button
        type="button"
        disabled={isHost && isMembersLoading}
        onClick={openLeaveDialog}
        className="h-12 w-full cursor-pointer rounded-lg border border-border bg-fill-subtle text-label-l-emphasis text-text transition-colors enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
      >
        방 나가기
      </button>

      {leaveDialog === "confirm" ? (
        <ConfirmDialog
          appearance="ledger"
          destructive
          title="방에서 나가시겠어요?"
          description={"방을 나가면 이 여행의 일정과 대화에\n더 이상 접근할 수 없어요."}
          confirmLabel="나가기"
          isPending={isLeaving}
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

      {transferTarget && currentRoomId ? (
        <ConfirmDialog
          appearance="ledger"
          title="방장을 위임하시겠어요?"
          description={`${transferTarget.nickname}님에게 방장을 넘기면\n나는 참여자가 돼요.`}
          confirmLabel="위임"
          isPending={isTransferring}
          onConfirm={() =>
            transfer(
              { roomId: currentRoomId, targetUserId: transferTarget.userId },
              { onSuccess: () => setTransferTarget(null) },
            )
          }
          onCancel={() => setTransferTarget(null)}
        />
      ) : null}

      {kickTarget && currentRoomId ? (
        <ConfirmDialog
          appearance="ledger"
          destructive
          title="강제 퇴장하시겠어요?"
          description={`${kickTarget.nickname}님을 이 여행에서 내보내요.`}
          confirmLabel="강제 퇴장"
          isPending={isKicking}
          onConfirm={() =>
            kick(
              { roomId: currentRoomId, userId: kickTarget.userId },
              { onSuccess: () => setKickTarget(null) },
            )
          }
          onCancel={() => setKickTarget(null)}
        />
      ) : null}
    </div>
  );
}
