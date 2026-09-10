"use client";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomUnreadCount } from "@/hooks/useRoomUnreadCount";
import { formatUnreadCountBadge } from "@/lib/chat/message-read";

export function SidebarChatUnreadBadge() {
  const { roomId } = useCurrentRoomId();
  const { data } = useRoomUnreadCount(roomId);
  const unreadCount = data?.unreadCount ?? 0;
  const label =
    !roomId || unreadCount === 0 ? "-" : formatUnreadCountBadge(unreadCount);

  return (
    <span className="pointer-events-none absolute right-0 top-0 rounded-full bg-primary px-1 text-[11px] font-bold leading-4 text-white">
      {label}
    </span>
  );
}
