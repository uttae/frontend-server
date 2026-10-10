import type { RoomMember } from "@/lib/api/rooms";
import { isActiveRoomMember } from "@/lib/api/rooms/members";

export const HEADER_AVATAR_LIMIT = 2;

export type HeaderMemberPreviewItem = { member: RoomMember; isOnline: boolean };

/**
 * 헤더 구성원 미리보기 — 온라인 구성원, 오프라인 구성원 순으로 최대 2명을 보여주고 나머지는 +N으로 묶는다.
 * 화면을 보고 있는 본인은 접속 상태와 관계없이 온라인으로 맨 앞에 둔다.
 */
export function selectHeaderMemberPreview(
  members: readonly RoomMember[],
  viewerId: number | undefined,
  limit = HEADER_AVATAR_LIMIT,
): { visible: HeaderMemberPreviewItem[]; restCount: number } {
  const active = members.filter(isActiveRoomMember);
  const isOnline = (member: RoomMember) => member.userId === viewerId || member.isOnline;
  const ordered = [
    ...active.filter((member) => member.userId === viewerId),
    ...active.filter((member) => member.userId !== viewerId && member.isOnline),
    ...active.filter((member) => !isOnline(member)),
  ];
  const visible = ordered.slice(0, limit).map((member) => ({ member, isOnline: isOnline(member) }));
  return { visible, restCount: active.length - visible.length };
}
