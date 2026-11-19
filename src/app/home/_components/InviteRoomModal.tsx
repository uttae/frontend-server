"use client";

import type { ComponentProps } from "react";

import { InviteRoomDialog } from "@/components/rooms/InviteRoomDialog";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import type { RoomListItem } from "@/lib/api/rooms";

export function InviteRoomModal({ room, finalFocus, onClose }: Readonly<{
  room: RoomListItem;
  finalFocus: ComponentProps<typeof InviteRoomDialog>["finalFocus"];
  onClose: () => void;
}>) {
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
      finalFocus={finalFocus}
    />
  );
}
