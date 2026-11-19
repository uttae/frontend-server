import type { RoomMember } from "@/lib/api/rooms";
import { isActiveRoomMember } from "@/lib/api/rooms/members";

export const HEADER_AVATAR_LIMIT = 2;

export type HeaderMemberPreviewItem = { member: RoomMember; isOnline: boolean };

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
