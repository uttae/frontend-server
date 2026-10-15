"use client";

import { InviteRoomDialog } from "@/components/rooms/InviteRoomDialog";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import type { RoomListItem } from "@/lib/api/rooms";

/** 홈 방 카드 메뉴의 초대 — 헤더와 같은 초대하기 모달에 이 방의 정보를 넘긴다 */
export function InviteRoomModal({ room, onClose }: {
  room: RoomListItem;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useRoomDetail(room.id);

  return (
    <InviteRoomDialog
      roomId={room.id}
      inviteCode={data?.inviteCode}
      memberCount={data?.memberCount}
      role={data?.role}
      isRoomDetailLoading={isLoading}
      isRoomDetailError={isError}
      onRetryRoomDetail={() => { void refetch(); }}
      onClose={onClose}
    />
  );
}
