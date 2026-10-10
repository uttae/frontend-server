"use client";

import { LoadingIndicator } from "@/components/loading/LoadingIndicator";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { AddMemberPanel } from "./AddMemberPanel";
import { JoinRequestsSection } from "./JoinRequestsSection";
import { MemberList } from "./MemberList";
import { useMemberActions } from "./useMemberActions";

/** 모바일 초대하기 페이지 — PC는 헤더 드롭다운·초대하기 모달을 쓴다 */
export function RoomMembersSection() {
  const {
    roomId: currentRoomId,
    me,
    others,
    isHost,
    roomDetail,
    isDetailLoading,
    isDetailError,
    isMembersLoading,
    memberCount,
    leaveDisabled,
    openLeaveDialog,
    requestKick,
    requestTransfer,
    dialogs,
  } = useMemberActions();

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
          <MemberList me={me} others={others} isHost={isHost} onKick={requestKick} onTransfer={requestTransfer} />
        )}
      </section>

      <hr className="border-border-subtle" />

      <button
        type="button"
        disabled={leaveDisabled}
        onClick={openLeaveDialog}
        className="h-12 w-full cursor-pointer rounded-lg border border-border bg-fill-subtle text-label-l-emphasis text-text transition-colors enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
      >
        방 나가기
      </button>

      {dialogs}
    </div>
  );
}
