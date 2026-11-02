"use client";

import { useState } from "react";

import { JoinRequestsSection } from "@/app/(main)/member-settings/_components/JoinRequestsSection";
import { MemberList } from "@/app/(main)/member-settings/_components/MemberList";
import { useMemberActions } from "@/app/(main)/member-settings/_components/useMemberActions";
import { ChevronDownIcon, SendIcon } from "@/assets/icons";
import { InviteRoomDialog } from "@/components/rooms/InviteRoomDialog";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user/UserAvatar";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { selectHeaderMemberPreview } from "@/lib/rooms/member-preview";
import { cn } from "@/lib/utils";

import { SidebarPingBadge } from "./SidebarPingBadge";

/** 드롭다운 구성원 목록 — 4명(카드 72px + 사이 간격·구분선)까지 보이고 넘치면 스크롤 */
const MEMBER_LIST_MAX_HEIGHT_CLASS = "max-h-[339px]";

function memberPreviewLabel(memberCount: number, pendingJoinRequestsCount: number) {
  const label = `구성원 ${memberCount}명`;
  return pendingJoinRequestsCount > 0 ? `${label}, 참여 요청 ${pendingJoinRequestsCount}건` : label;
}

/** PC 헤더 우측 — 구성원 미리보기(드롭다운으로 구성원 관리)와 초대하기(모달) */
export function HeaderMemberPreview() {
  const {
    user,
    roomId,
    members,
    me,
    others,
    isHost,
    roomDetail,
    isDetailLoading,
    isDetailError,
    memberCount,
    leaveDisabled,
    openLeaveDialog,
    requestKick,
    requestTransfer,
    dialogs,
  } = useMemberActions();
  const pendingJoinRequestsCount = useHostJoinRequestsBadgeCount();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { visible, restCount } = selectHeaderMemberPreview(members, user?.id);

  return (
    <div className="flex shrink-0 items-center gap-3">
      {visible.length > 0 ? (
        // 패널 안 구성원 옵션 메뉴(MemberCard DropdownMenu)는 이 패널의 React 자식이라 Base UI가 안쪽으로 본다.
        // 메뉴 포털은 패널 포털 안에 붙고(FloatingPortal parentPortalNode), 메뉴를 누르면 패널 Popup의 capture 핸들러가 먼저 '안쪽'으로 표시해(useDismiss insideReactTree) 패널이 닫히지 않는다
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger
            aria-label={memberPreviewLabel(memberCount, pendingJoinRequestsCount)}
            className="isolate flex cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AvatarGroup>
              {visible.map(({ member, isOnline }, index) => (
                <UserAvatar
                  key={member.userId}
                  user={member}
                  size={28}
                  tone={isOnline ? "primary" : "neutral"}
                  ring={isOnline ? "online" : "offline"}
                  // 앞사람(본인)이 위에 온다. +N(z-1)·화살표(z-0)보다 위 층이다
                  style={{ zIndex: visible.length - index + 1 }}
                />
              ))}
              {restCount > 0 ? (
                <AvatarGroupCount aria-hidden className="z-1">
                  +{restCount}
                </AvatarGroupCount>
              ) : null}
              {/* 묶음(isolate) 밖에 두면 마지막 아바타를 덮으므로 안에서 가장 아래 층에 둔다 */}
              <span aria-hidden className="relative z-0 flex size-7 items-center justify-center rounded-full bg-fill">
                <ChevronDownIcon size={16} className={cn("text-icon-subtle transition-transform", dropdownOpen && "rotate-180")} />
                {pendingJoinRequestsCount > 0 ? <SidebarPingBadge className="-right-1 -top-1" /> : null}
              </span>
            </AvatarGroup>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="구성원 관리">
            {isHost && roomId ? <JoinRequestsSection roomId={roomId} /> : null}
            <section aria-label="구성원" className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 text-title-s text-text">
                <span>구성원</span>
                <span className="text-body-m-regular font-medium text-primary">{memberCount}</span>
              </h2>
              <MemberList
                me={me}
                others={others}
                isHost={isHost}
                onKick={(member) => {
                  setDropdownOpen(false);
                  requestKick(member);
                }}
                onTransfer={(member) => {
                  setDropdownOpen(false);
                  requestTransfer(member);
                }}
                className={cn(MEMBER_LIST_MAX_HEIGHT_CLASS, "-mx-1 overflow-y-auto overscroll-contain px-1 [&>li]:py-2 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0")}
              />
            </section>
            <hr className="border-border-subtle" />
            <Button
              variant="outline"
              disabled={leaveDisabled}
              onClick={() => {
                setDropdownOpen(false);
                openLeaveDialog();
              }}
              className="w-full"
            >
              방 나가기
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}

      <button
        type="button"
        data-tutorial-target="member-settings"
        aria-haspopup="dialog"
        onClick={() => {
          setDropdownOpen(false);
          setInviteOpen(true);
        }}
        className="flex cursor-pointer items-center gap-1 rounded-sm text-label-m-emphasis text-primary transition-colors hover:text-primary-strong hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <SendIcon size={16} />
        초대하기
      </button>

      {inviteOpen && roomId ? (
        <InviteRoomDialog
          roomId={roomId}
          inviteCode={roomDetail?.inviteCode}
          memberCount={roomDetail?.memberCount}
          role={roomDetail?.role}
          isRoomDetailLoading={isDetailLoading}
          isRoomDetailError={isDetailError}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {dialogs}
    </div>
  );
}
