"use client";

import type { RoomMember } from "@/lib/api/rooms";
import { cn } from "@/lib/utils";

import { MemberCard, type MemberCardData } from "./MemberCard";

function toMemberCardData(member: RoomMember, isCurrentUser: boolean): MemberCardData {
  return {
    id: String(member.userId),
    name: member.nickname,
    profileImageUrl: member.profileImageUrl,
    role: member.role,
    status: member.status,
    isCurrentUser,
    // 화면을 보고 있는 본인은 접속 중으로 표시한다
    connectionStatus: isCurrentUser || member.isOnline ? "online" : "offline",
  };
}

/** 현재 구성원 목록 — 본인, 온라인, 오프라인 순으로 두고 구분선으로 나눈다 */
export function MemberList({
  me,
  others,
  isHost,
  onKick,
  onTransfer,
  className,
}: {
  me: RoomMember | undefined;
  others: readonly RoomMember[];
  isHost: boolean;
  onKick: (member: RoomMember) => void;
  onTransfer: (member: RoomMember) => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col divide-y divide-border-subtle", className)}>
      {me ? (
        <li>
          <MemberCard member={toMemberCardData(me, true)} isViewerHost={isHost} onKick={() => {}} onTransfer={() => {}} />
        </li>
      ) : null}
      {[...others].sort((a, b) => Number(b.isOnline) - Number(a.isOnline)).map((member) => (
        <li key={member.userId}>
          <MemberCard
            member={toMemberCardData(member, false)}
            isViewerHost={isHost}
            onKick={() => onKick(member)}
            onTransfer={() => onTransfer(member)}
          />
        </li>
      ))}
    </ul>
  );
}
