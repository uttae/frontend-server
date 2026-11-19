"use client";

import { useRef, useState } from "react";

import { JoinRequestsSection } from "@/app/(main)/member-settings/_components/JoinRequestsSection";
import { MemberList } from "@/app/(main)/member-settings/_components/MemberList";
import { useMemberActions } from "@/app/(main)/member-settings/_components/useMemberActions";
import { ChevronDownIcon, PlusIcon, UserAddIcon } from "@/assets/icons";
import { InviteRoomDialog } from "@/components/rooms/InviteRoomDialog";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user/UserAvatar";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { selectHeaderMemberPreview } from "@/lib/rooms/member-preview";
import { cn } from "@/lib/utils";

import { SidebarPingBadge } from "./SidebarPingBadge";

const MEMBER_LIST_MAX_HEIGHT_CLASS = "max-h-[339px]";

function memberPreviewLabel(memberCount: number, pendingJoinRequestsCount: number) {
  const label = `구성원 ${memberCount}명`;
  return pendingJoinRequestsCount > 0 ? `${label}, 참여 요청 ${pendingJoinRequestsCount}건` : label;
}

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
  const [inviteInPanel, setInviteInPanel] = useState(false);
  const headerInviteRef = useRef<HTMLButtonElement>(null);
  const { visible, restCount } = selectHeaderMemberPreview(members, user?.id);

  const openInvite = () => {
    setDropdownOpen(false);
    setInviteOpen(true);
  };

  return (
    <div data-tutorial-target="member-settings" className="flex shrink-0 items-center">
      {visible.length > 0 ? (
        <Popover
          open={dropdownOpen}
          onOpenChange={(open) => {
            if (open && headerInviteRef.current) {
              setInviteInPanel(getComputedStyle(headerInviteRef.current).display === "none");
            }
            setDropdownOpen(open);
          }}
        >
          <PopoverTrigger
            aria-label={memberPreviewLabel(memberCount, pendingJoinRequestsCount)}
            className="relative flex cursor-pointer items-center gap-0.5 rounded-full border border-border bg-fill py-1 ps-1 pe-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AvatarGroup>
              {visible.map(({ member, isOnline }, index) => (
                <UserAvatar
                  key={member.userId}
                  user={member}
                  size={32}
                  tone={isOnline ? "primary" : "neutral"}
                  ring={isOnline ? "online" : "offline"}
                  style={{ zIndex: visible.length - index }}
                />
              ))}
            </AvatarGroup>
            {restCount > 0 ? (
              <AvatarGroupCount aria-hidden>
                <PlusIcon size={16} />
                {restCount}
              </AvatarGroupCount>
            ) : null}
            <span aria-hidden className="flex">
              <ChevronDownIcon
                size={20}
                className={cn("text-icon-subtle transition-transform", dropdownOpen && "rotate-180")}
              />
            </span>
            {pendingJoinRequestsCount > 0 ? <SidebarPingBadge className="right-0.5 top-1" /> : null}
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
                className={cn(
                  MEMBER_LIST_MAX_HEIGHT_CLASS,
                  "-mx-1 overflow-y-auto overscroll-contain px-1 [&>li]:py-2 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0",
                )}
              />
            </section>
            <hr className="border-border-subtle" />
            <div className="flex flex-col gap-2">
              {inviteInPanel ? (
                <Button variant="outline" aria-haspopup="dialog" onClick={openInvite} className="w-full">
                  <UserAddIcon data-icon="inline-start" className="text-primary" />
                  초대하기
                </Button>
              ) : null}
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
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <Button
        ref={headerInviteRef}
        variant="text"
        aria-haspopup="dialog"
        onClick={openInvite}
        className="hidden @min-[480px]/header:inline-flex"
      >
        <UserAddIcon data-icon="inline-start" className="text-primary" />
        초대하기
      </Button>

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
