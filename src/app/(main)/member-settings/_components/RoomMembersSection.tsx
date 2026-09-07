"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DeleteConfirmModal } from "@/app/home/_components/DeleteConfirmModal";
import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import {
  pageToolbarButtonCompactGapClass,
  pageToolbarButtonCompactIconClass,
  pageToolbarButtonCompactIconStroke,
  pageToolbarButtonCompactPaddingClass,
  pageToolbarButtonCompactTextClass,
} from "@/components/layout/page-toolbar-button";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { useCurrentRoomMembership } from "@/hooks/useCurrentRoomMembership";
import { useKickMember, useLeaveRoom, useTransferHost } from "@/hooks/useRooms";
import type { RoomMember } from "@/lib/api/rooms";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { useSessionStore } from "@/stores/session-store";
import { cn } from "@/lib/utils";
import { AddMemberPanel } from "./AddMemberPanel";
import { MemberCard, type MemberCardData } from "./MemberCard";
import { MemberSettingsHostGuard } from "./MemberSettingsHostGuard";

function toMemberCardData(
  member: RoomMember,
  isCurrentUser: boolean,
): MemberCardData {
  const isLeft = member.status === "LEFT";
  return {
    id: String(member.userId),
    name: member.nickname,
    avatarInitial: member.nickname.charAt(0),
    profileImageUrl: member.profileImageUrl,
    role: member.role,
    status: member.status,
    isCurrentUser,
    connectionStatus: isLeft
      ? undefined
      : member.isOnline
        ? "online"
        : "offline",
  };
}

export function RoomMembersSection() {
  const router = useRouter();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDelegateFirstModal, setShowDelegateFirstModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [kickTargetId, setKickTargetId] = useState<number | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<number | null>(null);

  const {
    user,
    roomId: currentRoomId,
    currentRoom,
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

  function finishLeaveSession() {
    clearCurrentRoomId();
    router.replace("/home");
  }

  async function handleLeaveRoom() {
    if (!currentRoomId || !user) return;
    if (isHost && hostCannotLeaveAlone) {
      toast.error(
        "다른 멤버가 없어 방장을 넘길 수 없습니다. 여행 삭제를 이용해 주세요.",
      );
      return;
    }
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

  useEffect(() => {
    if (!showDelegateFirstModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDelegateFirstModal(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showDelegateFirstModal]);

  return (
    <div className="relative flex flex-col gap-6">
      <MainPageHeader
        title="멤버 관리"
        action={
          isHost ? (
            <button
              type="button"
              onClick={() => setShowInvitePanel((open) => !open)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center rounded-full shadow-sm transition-opacity hover:opacity-95 active:opacity-90",
                pageToolbarButtonCompactGapClass,
                pageToolbarButtonCompactTextClass,
                pageToolbarButtonCompactPaddingClass,
                showInvitePanel
                  ? "bg-white text-primary ring-2 ring-primary ring-offset-1 hover:bg-gray-50"
                  : "bg-primary text-white",
              )}
            >
              <Plus
                className={pageToolbarButtonCompactIconClass}
                strokeWidth={pageToolbarButtonCompactIconStroke}
                aria-hidden
              />
              멤버 초대
            </button>
          ) : undefined
        }
      />

      <MemberSettingsHostGuard />

      {/* 멤버 초대 패널 */}
      {showInvitePanel && currentRoomId && (
        <AddMemberPanel
          key={currentRoomId}
          roomId={currentRoomId}
          inviteCode={roomDetail?.inviteCode}
          memberCount={roomDetail?.memberCount}
          role={roomDetail?.role}
          isRoomDetailLoading={isDetailLoading}
          isRoomDetailError={isDetailError}
          onClose={() => setShowInvitePanel(false)}
        />
      )}

      {/* 로딩 */}
      {isMembersLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
        </div>
      )}

      {/* 나 */}
      {!isMembersLoading && me && (
        <section>
          <p className="mb-1.5 text-[14px] font-semibold uppercase tracking-wide text-dark-gray">
            나
          </p>
          <div className="rounded-xl border border-gray-border bg-white">
            <MemberCard
              member={toMemberCardData(me, true)}
              isViewerHost={isHost}
              onKick={() => {}}
              onTransfer={() => {}}
            />
          </div>
        </section>
      )}

      {/* 다른 멤버 */}
      {!isMembersLoading && others.length > 0 && (
        <section>
          <p className="mb-1.5 text-[14px] font-semibold uppercase tracking-wide text-dark-gray">
            멤버 · {others.length}
          </p>
          <div className="rounded-xl border border-gray-border bg-white">
            {others.map((member, i) => (
              <div key={member.userId}>
                <div
                  className={
                    i < others.length - 1 && kickTargetId !== member.userId
                      ? "border-b border-gray-border"
                      : ""
                  }
                >
                  <MemberCard
                    member={toMemberCardData(member, false)}
                    isViewerHost={isHost}
                    onKick={() => {
                      setTransferTargetId(null);
                      setKickTargetId(member.userId);
                    }}
                    onTransfer={() => {
                      setKickTargetId(null);
                      setTransferTargetId(member.userId);
                    }}
                  />
                </div>

                {/* 방장 위임 확인 인라인 UI */}
                {transferTargetId === member.userId && (
                  <div
                    className={cn(
                      "border-b border-gray-border bg-primary/5 py-3",
                      MAIN_CARD_INNER_PADDING_X_CLASS,
                    )}
                  >
                    <p className="mb-2 text-[14px] font-medium text-gray-800">
                      <span className="font-semibold">{member.nickname}</span>님에게 방장을 위임하시겠어요?
                    </p>
                    <p className="mb-3 text-[13px] text-dark-gray">
                      위임 후 당신은 일반 멤버가 됩니다.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTransferTargetId(null)}
                        disabled={isTransferring}
                        className="flex-1 cursor-pointer rounded-lg border border-gray-border py-1.5 text-[14px] font-medium text-dark-gray transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => {
                          if (!currentRoomId) return;
                          transfer(
                            { roomId: currentRoomId, targetUserId: member.userId },
                            { onSuccess: () => setTransferTargetId(null) },
                          );
                        }}
                        disabled={isTransferring}
                        className="flex-1 cursor-pointer rounded-lg bg-primary py-1.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isTransferring ? "처리 중…" : "위임"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 추방 확인 인라인 UI */}
                {kickTargetId === member.userId && (
                  <div
                    className={cn(
                      "border-b border-gray-border bg-primary/5 py-3",
                      MAIN_CARD_INNER_PADDING_X_CLASS,
                    )}
                  >
                    <p className="mb-2 text-[14px] font-medium text-gray-800">
                      <span className="font-semibold">{member.nickname}</span>님을 추방하시겠어요?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setKickTargetId(null)}
                        disabled={isKicking}
                        className="flex-1 cursor-pointer rounded-lg border border-gray-border py-1.5 text-[14px] font-medium text-dark-gray transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => {
                          if (!currentRoomId) return;
                          kick(
                            { roomId: currentRoomId, userId: member.userId },
                            { onSuccess: () => setKickTargetId(null) },
                          );
                        }}
                        disabled={isKicking}
                        className="flex-1 cursor-pointer rounded-lg bg-primary py-1.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isKicking ? "처리 중…" : "추방"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 이전 멤버 */}
      {!isMembersLoading && leftOthers.length > 0 && (
        <section>
          <p className="mb-1.5 text-[14px] font-semibold uppercase tracking-wide text-dark-gray">
            이전 멤버 · {leftOthers.length}
          </p>
          <div className="rounded-xl border border-gray-border bg-white">
            {leftOthers.map((member, i) => (
              <div
                key={member.userId}
                className={
                  i < leftOthers.length - 1 ? "border-b border-gray-border" : ""
                }
              >
                <MemberCard
                  member={toMemberCardData(member, false)}
                  isViewerHost={isHost}
                  onKick={() => {}}
                  onTransfer={() => {}}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2 border-t border-gray-border pt-4">
        {!showLeaveConfirm ? (
          <SettingsActionButtonRow className="pt-0">
            <SettingsActionButton
              variant="secondary"
              disabled={isHost && isMembersLoading}
              onClick={() => {
                if (hostNeedsManualDelegation) {
                  setShowDelegateFirstModal(true);
                  return;
                }
                setShowLeaveConfirm(true);
              }}
            >
              방 나가기
            </SettingsActionButton>
            {isHost && currentRoom && (
              <SettingsActionButton
                variant="primary"
                onClick={() => setShowDeleteConfirm(true)}
              >
                여행 삭제
              </SettingsActionButton>
            )}
          </SettingsActionButtonRow>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="mb-3 text-[17px] font-medium text-gray-800">
              정말 방에서 나가시겠어요?
            </p>
            <p className="mb-4 text-[14px] leading-5 text-dark-gray">
              방을 나가면 현재 여행 플랜에 접근할 수 없게 됩니다.
              {isHost && hostCannotLeaveAlone && (
                <span className="mt-1 block font-medium text-primary">
                  다른 멤버가 없으면 나갈 수 없습니다. 여행 삭제를 이용해 주세요.
                </span>
              )}
            </p>
            <SettingsActionButtonRow className="pt-0">
              <SettingsActionButton
                variant="secondary"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={isLeaving}
              >
                취소
              </SettingsActionButton>
              <SettingsActionButton
                variant="primary"
                onClick={() => {
                  void handleLeaveRoom();
                }}
                disabled={
                  isLeaving ||
                  hostCannotLeaveAlone ||
                  hostNeedsManualDelegation ||
                  (isHost && isMembersLoading)
                }
              >
                {isLeaving ? "처리 중…" : "나가기"}
              </SettingsActionButton>
            </SettingsActionButtonRow>
          </div>
        )}
      </div>

      {showDeleteConfirm && currentRoom && (
        <DeleteConfirmModal
          room={currentRoom}
          onClose={() => setShowDeleteConfirm(false)}
          onDeleted={finishLeaveSession}
        />
      )}

      {showDelegateFirstModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDelegateFirstModal(false);
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delegate-first-title"
            className="w-full max-w-sm rounded-2xl border border-gray-border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delegate-first-title"
              className="text-[19px] font-semibold text-neutral-900"
            >
              먼저 방장을 위임해주세요
            </h3>
            <p className="mt-3 text-[17px] leading-relaxed text-dark-gray">
              멤버에게 방장을 넘긴 뒤 나가실 수 있어요.
            </p>
            <SettingsActionButton
              variant="primary"
              flex={false}
              className="mt-6 w-full"
              onClick={() => setShowDelegateFirstModal(false)}
            >
              확인
            </SettingsActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
