"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MenuDotHorizontalIcon, UserEditIcon, UserXIcon } from "@/assets/icons";
import { UserAvatar } from "@/components/user/UserAvatar";
import type { RoomMemberStatus } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

export type MemberRole = "HOST" | "MEMBER";

export type MemberCardData = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  role: MemberRole;
  status?: RoomMemberStatus;
  isCurrentUser?: boolean;
  /** GET /rooms/.../members 의 `isOnline` — LEFT 또는 미지정 시 접속 상태를 숨깁니다 */
  connectionStatus?: "online" | "offline";
};

type Props = {
  member: MemberCardData;
  isViewerHost: boolean;
  onKick: (memberId: string) => void;
  onTransfer: (memberId: string) => void;
};

export function MemberCard({ member, isViewerHost, onKick, onTransfer }: Props) {
  const isLeft = member.status === "LEFT";
  const isOnline = member.connectionStatus === "online";
  const canAct =
    isViewerHost &&
    !member.isCurrentUser &&
    member.role !== "HOST" &&
    !isLeft;

  // 스크롤 영역(헤더 드롭다운) 안에서도 잘리지 않도록 메뉴는 body에 화면 기준 위치로 띄운다
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const open = menuPosition !== null;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggleMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    setMenuPosition(open || !rect ? null : { top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setMenuPosition(null);
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={cn("flex min-h-[72px] items-center gap-3", isLeft && "opacity-60")}>
      <UserAvatar
        user={{ nickname: member.name, profileImageUrl: member.profileImageUrl ?? null }}
        size={36}
        className={isOnline ? "bg-primary-subtle ring-2 ring-status-positive" : "bg-fill ring-1 ring-border-subtle"}
        initialClassName={cn("font-medium", isOnline ? "text-primary" : "text-text-subtle")}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("truncate text-body-m-regular font-medium mobile:text-body-s-regular", isOnline || member.isCurrentUser ? "text-text" : "text-text-subtle")}>
          {member.name}
          {member.isCurrentUser ? " (나)" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-label-xs-regular",
              member.role === "HOST" ? "bg-primary-subtle text-primary" : "bg-fill text-text-subtle",
            )}
          >
            {member.role === "HOST" ? "방장" : "참여자"}
          </span>
          {isLeft ? (
            <span className="text-caption-m-regular text-text-subtle">방 나감</span>
          ) : member.connectionStatus ? (
            <span className="flex items-center gap-2 text-caption-m-regular text-text-subtle">
              <span aria-hidden className={cn("size-1.5 rounded-full", isOnline ? "bg-status-positive" : "bg-icon-disabled")} />
              {isOnline ? "온라인" : "오프라인"}
            </span>
          ) : null}
        </div>
      </div>

      {canAct && (
        <div className="shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleMenu}
            aria-label={`${member.name} 옵션`}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-icon transition-colors hover:bg-fill aria-expanded:bg-fill"
          >
            <MenuDotHorizontalIcon size={24} />
          </button>

          {menuPosition && createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-floating-menu
              style={menuPosition}
              className="fixed z-[60] w-60 rounded-xl bg-fill-elevate p-2 shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onTransfer(member.id);
                  setMenuPosition(null);
                }}
                className="flex h-10 w-full cursor-pointer items-center gap-2.5 border-b-[0.5px] border-border-subtle pl-3.5 text-left text-label-m-regular text-text transition-colors hover:bg-fill"
              >
                <UserEditIcon size={20} className="text-icon-subtle" />
                방장 위임
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onKick(member.id);
                  setMenuPosition(null);
                }}
                className="flex h-10 w-full cursor-pointer items-center gap-2.5 pl-3.5 text-left text-label-m-regular text-status-negative transition-colors hover:bg-fill"
              >
                <UserXIcon size={20} />
                강제 퇴장
              </button>
            </div>,
            document.body,
          )}
        </div>
      )}
    </div>
  );
}
