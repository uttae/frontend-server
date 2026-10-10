"use client";

import { useEffect, useRef, useState } from "react";

import { AddMemberPanel } from "@/app/(main)/member-settings/_components/AddMemberPanel";
import { JoinRequestsSection } from "@/app/(main)/member-settings/_components/JoinRequestsSection";
import { MemberList } from "@/app/(main)/member-settings/_components/MemberList";
import { useMemberActions } from "@/app/(main)/member-settings/_components/useMemberActions";
import { ChevronDownIcon, SendIcon } from "@/assets/icons";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { visible, restCount } = selectHeaderMemberPreview(members, user?.id);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // 구성원 옵션 메뉴는 body에 떠 있으므로 드롭다운 바깥으로 보지 않는다
      if (dropdownRef.current?.contains(target) || target.closest("[data-floating-menu]")) return;
      setDropdownOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen]);

  return (
    <div className="flex shrink-0 items-center gap-3">
      {visible.length > 0 ? (
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            aria-label={memberPreviewLabel(memberCount, pendingJoinRequestsCount)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((open) => !open)}
            className="isolate flex cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex items-center">
              {visible.map(({ member, isOnline }, index) => (
                <span
                  key={member.userId}
                  aria-hidden
                  style={{ zIndex: visible.length - index + 1 }}
                  className={index > 0 ? "relative -ml-1.5" : "relative"}
                >
                  <UserAvatar
                    user={member}
                    size={28}
                    className={isOnline ? "bg-primary-subtle ring-2 ring-status-positive" : "bg-fill ring-2 ring-border grayscale brightness-110 contrast-75"}
                    initialClassName={cn("font-medium", isOnline ? "text-primary" : "text-text-subtle")}
                  />
                </span>
              ))}
              {restCount > 0 ? (
                <span
                  aria-hidden
                  className="relative z-[1] -ml-1.5 flex size-7 items-center justify-center rounded-full bg-fill text-label-m-regular text-text-subtle"
                >
                  +{restCount}
                </span>
              ) : null}
              <span aria-hidden className="relative z-0 -ml-1.5 flex size-7 items-center justify-center rounded-full bg-fill">
                <ChevronDownIcon size={16} className={cn("text-icon-subtle transition-transform", dropdownOpen && "rotate-180")} />
                {pendingJoinRequestsCount > 0 ? <SidebarPingBadge className="-right-1 -top-1" /> : null}
              </span>
            </span>
          </button>

          {dropdownOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 flex w-[305px] flex-col gap-4 rounded-xl bg-fill-elevate p-6 shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
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
              <button
                type="button"
                disabled={leaveDisabled}
                onClick={() => {
                  setDropdownOpen(false);
                  openLeaveDialog();
                }}
                className="h-12 w-full cursor-pointer rounded-lg border border-border bg-fill-subtle text-label-l-emphasis text-text transition-colors enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
              >
                방 나가기
              </button>
            </div>
          ) : null}
        </div>
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
        <SettingsDialog title="초대하기" appearance="alert" onClose={() => setInviteOpen(false)}>
          <p className="text-body-l-regular text-text">링크를 공유해 함께 여행을 계획해 보세요.</p>
          <div className="mt-4">
            <AddMemberPanel
              key={roomId}
              roomId={roomId}
              inviteCode={roomDetail?.inviteCode}
              memberCount={roomDetail?.memberCount}
              role={roomDetail?.role}
              isHost={isHost}
              isRoomDetailLoading={isDetailLoading}
              isRoomDetailError={isDetailError}
              showDescription={false}
            />
          </div>
        </SettingsDialog>
      ) : null}

      {dialogs}
    </div>
  );
}
