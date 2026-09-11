"use client";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomUnreadCount } from "@/hooks/useRoomUnreadCount";
import { formatUnreadCountBadge } from "@/lib/chat/message-read";

export function SidebarChatUnreadBadge() {
  const { roomId } = useCurrentRoomId();
  const { data } = useRoomUnreadCount(roomId);
  const unreadCount = data?.unreadCount ?? 0;
  if (!roomId || unreadCount <= 0) return null;
  const label = formatUnreadCountBadge(unreadCount);

  return (
    <span className="pointer-events-none absolute right-4 top-2 rounded-full border border-background bg-primary px-1 text-[11px] font-bold leading-4 text-white">
      {label}
    </span>
  );
}
