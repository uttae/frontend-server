"use client";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useJoinRequests, useRoomsList } from "@/hooks/useRooms";
import { selectHostRoom } from "@/lib/rooms";

export function useHostJoinRequestsBadgeCount(): number {
  const { roomId } = useCurrentRoomId();
  const { data: roomsData } = useRoomsList();

  const hostRoom = selectHostRoom(roomsData?.rooms, roomId, "currentRoomHostOnly");

  const hostRoomId = hostRoom?.id ?? null;
  const { data } = useJoinRequests(hostRoomId, {
    enabled: Boolean(hostRoomId),
  });

  return data?.requests.length ?? 0;
}
