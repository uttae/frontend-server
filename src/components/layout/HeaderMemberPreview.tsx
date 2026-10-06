"use client";

import Link from "next/link";

import { SendIcon } from "@/assets/icons";
import { UserAvatar } from "@/components/user/UserAvatar";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { useRoomMembers } from "@/hooks/useRooms";
import { useSessionUser } from "@/hooks/useSessionUser";
import { selectHeaderMemberPreview } from "@/lib/rooms/member-preview";

import { SidebarPingBadge } from "./SidebarPingBadge";

const MEMBER_SETTINGS_HREF = "/member-settings";

/** 헤더 우측 — 온라인 구성원 미리보기(최대 3명 + 나머지 인원)와 초대하기 */
export function HeaderMemberPreview() {
  const { roomId } = useCurrentRoomId();
  const { data: user } = useSessionUser();
  const { data: membersData } = useRoomMembers(roomId);
  const pendingJoinRequestsCount = useHostJoinRequestsBadgeCount();
  const { visible, restCount } = selectHeaderMemberPreview(
    membersData?.members ?? [],
    user?.id,
  );
  const memberCount = visible.length + restCount;

  return (
    <div className="flex shrink-0 items-center gap-3">
      {memberCount > 0 ? (
        <Link
          href={MEMBER_SETTINGS_HREF}
          aria-label={`구성원 ${memberCount}명`}
          className="relative isolate flex items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {visible.map((member, index) => (
            <span
              key={member.userId}
              aria-hidden
              style={{ zIndex: visible.length - index + 1 }}
              className={index > 0 ? "relative -ml-1.5" : "relative"}
            >
              <UserAvatar
                user={member}
                size={28}
                className="bg-primary-subtle"
                initialClassName="font-medium text-primary"
              />
            </span>
          ))}
          {restCount > 0 ? (
            <span
              aria-hidden
              className="relative z-0 -ml-1.5 flex size-7 items-center justify-center rounded-full bg-fill text-label-m-regular text-text-subtle"
            >
              +{restCount}
            </span>
          ) : null}
          {pendingJoinRequestsCount > 0 ? (
            <SidebarPingBadge className="-right-1 -top-1 z-10" />
          ) : null}
        </Link>
      ) : null}
      <Link
        href={MEMBER_SETTINGS_HREF}
        data-tutorial-target="member-settings"
        aria-label={pendingJoinRequestsCount > 0 ? `초대하기, 참여 요청 ${pendingJoinRequestsCount}건` : "초대하기"}
        className="flex items-center gap-1 rounded-sm text-label-m-emphasis text-primary transition-colors hover:text-primary-strong hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="relative">
          <SendIcon size={16} />
          {pendingJoinRequestsCount > 0 && memberCount === 0 ? (
            <SidebarPingBadge className="-right-2 -top-2" />
          ) : null}
        </span>
        초대하기
      </Link>
    </div>
  );
}
