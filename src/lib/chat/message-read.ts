import type { Client } from "@stomp/stompjs";
import type { QueryClient } from "@tanstack/react-query";

import { roomUnreadCountQueryKey } from "@/lib/query-keys";

export function formatUnreadCountBadge(count: number): string {
  return count >= 100 ? "99+" : String(count);
}

export function invalidateRoomUnreadCount(
  queryClient: QueryClient,
  roomId: string,
): void {
  void queryClient.invalidateQueries({
    queryKey: roomUnreadCountQueryKey(roomId),
  });
}

export function optimisticallyClearRoomUnreadCount(
  queryClient: QueryClient,
  roomId: string,
): void {
  void queryClient.cancelQueries({ queryKey: roomUnreadCountQueryKey(roomId) });
  queryClient.setQueryData(roomUnreadCountQueryKey(roomId), { unreadCount: 0 });
}

export function publishRoomMessageRead(
  client: Client,
  roomId: string,
  messageId: string,
): void {
  client.publish({
    destination: `/app/rooms/${roomId}/messages/read`,
    body: JSON.stringify({ lastReadMessageId: messageId }),
  });
}
