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
    <span className="pointer-events-none absolute left-1/2 top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-primary px-0.5 text-[11px] font-semibold leading-none tracking-[-0.02em] text-text-inverse">
      {label}
    </span>
  );
}
