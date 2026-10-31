"use client";

import { MenuDotHorizontalIcon, UserEditIcon, UserXIcon } from "@/assets/icons";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

function MemberConnectionStatus({ member }: Readonly<{ member: MemberCardData }>) {
  if (member.status === "LEFT") {
    return <span className="text-caption-m-regular text-text-subtle">방 나감</span>;
  }
  if (!member.connectionStatus) return null;
  const isOnline = member.connectionStatus === "online";
  return (
    <span className="flex items-center gap-2 text-caption-m-regular text-text-subtle">
      <span aria-hidden className={cn("size-1.5 rounded-full", isOnline ? "bg-status-positive" : "bg-icon-disabled")} />
      {isOnline ? "온라인" : "오프라인"}
    </span>
  );
}

export function MemberCard({ member, isViewerHost, onKick, onTransfer }: Readonly<Props>) {
  const isLeft = member.status === "LEFT";
  const isOnline = member.connectionStatus === "online";
  const canAct =
    isViewerHost &&
    !member.isCurrentUser &&
    member.role !== "HOST" &&
    !isLeft;

  return (
    <div className={cn("flex min-h-[72px] items-center gap-3", isLeft && "opacity-60")}>
      <UserAvatar
        user={{ nickname: member.name, profileImageUrl: member.profileImageUrl ?? null }}
        size={36}
        tone={isOnline ? "primary" : "neutral"}
        ring={isOnline ? "online" : "offline"}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("truncate text-body-m-regular font-medium mobile:text-body-s-regular", isOnline || member.isCurrentUser ? "text-text" : "text-text-subtle")}>
          {member.name}
          {member.isCurrentUser ? " (나)" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Badge tone={member.role === "HOST" ? "brand" : "neutral"} size="md">
            {member.role === "HOST" ? "방장" : "참여자"}
          </Badge>
          <MemberConnectionStatus member={member} />
        </div>
      </div>

      {canAct && (
        // 헤더 구성원 패널(Popover) 안에서 열리면 Base UI가 이 메뉴를 패널 안쪽으로 보아, 메뉴를 눌러도 패널이 닫히지 않는다(HeaderMemberPreview 주석)
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${member.name} 옵션`}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-icon transition-colors hover:bg-fill aria-expanded:bg-fill"
          >
            <MenuDotHorizontalIcon size={24} />
          </DropdownMenuTrigger>
          {/* 지금 메뉴 폭 w-60을 유지한다 */}
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => onTransfer(member.id)}>
              <UserEditIcon size={20} />
              방장 위임
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onKick(member.id)}>
              <UserXIcon size={20} />
              강제 퇴장
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
