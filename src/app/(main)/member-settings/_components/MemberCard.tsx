"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { RoomMemberStatus } from "@/lib/api/rooms";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

export type MemberRole = "HOST" | "MEMBER";

export type MemberCardData = {
  id: string;
  name: string;
  avatarInitial: string;
  profileImageUrl?: string | null;
  role: MemberRole;
  status?: RoomMemberStatus;
  isCurrentUser?: boolean;
  /** GET /rooms/.../members 의 `isOnline` — LEFT 또는 미지정 시 접속 상태 배지를 숨깁니다 */
  connectionStatus?: "online" | "offline";
};

type Props = {
  member: MemberCardData;
  isViewerHost: boolean;
  onKick: (memberId: string) => void;
  onTransfer: (memberId: string) => void;
};

function Avatar({
  name,
  initial,
  imageUrl,
}: {
  name: string;
  initial: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={36}
        height={36}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[17px] font-semibold text-primary">
      {initial}
    </div>
  );
}

export function MemberCard({ member, isViewerHost, onKick, onTransfer }: Props) {
  const isLeft = member.status === "LEFT";
  const canAct =
    isViewerHost &&
    !member.isCurrentUser &&
    member.role !== "HOST" &&
    !isLeft;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl py-2.5",
        MAIN_CARD_INNER_PADDING_X_CLASS,
        isLeft && "opacity-60",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar
          name={member.name}
          initial={member.avatarInitial}
          imageUrl={member.profileImageUrl}
        />
      </div>

      {/* Name + role */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[17px] font-medium text-gray-800">
            {member.name}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none ${
              member.role === "HOST"
                ? "bg-primary/10 text-primary"
                : "bg-gray-100 text-dark-gray"
            }`}
          >
            {member.role}
          </span>
          {isLeft ? (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none bg-gray-100 text-dark-gray">
              방 나감
            </span>
          ) : (
            <>
              {member.connectionStatus === "online" && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none bg-emerald-500/15 text-emerald-700">
                  온라인
                </span>
              )}
              {member.connectionStatus === "offline" && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none bg-gray-100 text-dark-gray">
                  오프라인
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ··· dropdown — HOST only, non-self, non-HOST targets */}
      {canAct && (
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
              open
                ? "border-gray-300 bg-gray-100 text-gray-700"
                : "border-transparent text-dark-gray hover:border-gray-border hover:bg-gray-50"
            }`}
            aria-label="멤버 옵션"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="2" cy="7" r="1.4" />
              <circle cx="7" cy="7" r="1.4" />
              <circle cx="12" cy="7" r="1.4" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full z-10 mt-1 w-32 rounded-xl border border-gray-border bg-white shadow-md">
              <button
                onClick={() => {
                  onTransfer(member.id);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 text-dark-gray"
                >
                  <path d="M6 1v10M1 6l5-5 5 5" />
                </svg>
                방장 위임
              </button>
              <div className="mx-3 h-px bg-gray-border" />
              <button
                onClick={() => {
                  onKick(member.id);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[14px] font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="flex-shrink-0"
                >
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
                강제 퇴장
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
