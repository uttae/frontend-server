"use client";

import { useMemo } from "react";

import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";

export function useCurrentRoomTitle(roomId: string | null): string {
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const { data: roomsData } = useRoomsList();
  const { data: roomDetail } = useRoomDetail(rid || null);

  return useMemo(() => {
    if (!rid.length) return "채팅";
    const fromList = roomsData?.rooms.find((r) => r.id === rid)?.title?.trim();
    if (fromList) return fromList;
    const fromDetail = roomDetail?.title?.trim();
    if (fromDetail) return fromDetail;
    return "채팅";
  }, [rid, roomsData?.rooms, roomDetail?.title]);
}
