import type { RoomMember } from "@/lib/api/rooms";
import { isActiveRoomMember } from "@/lib/api/rooms/members";

export const HEADER_ONLINE_AVATAR_LIMIT = 3;

/**
 * 헤더 구성원 미리보기 — 온라인 구성원을 최대 3명까지 보여주고, 나머지(남은 온라인 + 오프라인)는 +N으로 묶는다.
 * 화면을 보고 있는 본인은 접속 상태와 관계없이 온라인으로 맨 앞에 둔다.
 */
export function selectHeaderMemberPreview(
  members: readonly RoomMember[],
  viewerId: number | undefined,
  limit = HEADER_ONLINE_AVATAR_LIMIT,
): { visible: RoomMember[]; restCount: number } {
  const active = members.filter(isActiveRoomMember);
  const viewer = active.find((member) => member.userId === viewerId);
  const online = active.filter(
    (member) => member.userId !== viewerId && member.isOnline,
  );
  const visible = (viewer ? [viewer, ...online] : online).slice(0, limit);
  return { visible, restCount: active.length - visible.length };
}
