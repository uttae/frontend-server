import type { Client } from "@stomp/stompjs";
import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { dispatchHostJoinRequestFromStomp } from "@/lib/stomp/join-requests-dispatch";
import { resyncUserQueueDataAfterSubscribe } from "@/lib/stomp/room-resync-dispatch";
import {
  parseUserRoomQueueMessage,
  type ForcedRoomExitReason,
} from "@/lib/stomp/user-room-queue";

export type SubscribeUserRoomsQueueOptions = {
  queryClientRef: MutableRefObject<QueryClient>;
  notifyForcedRoomExit: (
    reason: ForcedRoomExitReason,
    eventRoomId: string,
    message?: string,
  ) => void;
};

/**
 * `/user/queue/rooms` — 로그인·STOMP 연결 동안 유지 (방 입장 여부와 무관).
 * 호스트 입장 요청은 방 밖에 있어도 동일 큐로 수신됩니다.
 */
export function subscribeUserRoomsQueue(
  client: Client,
  options: SubscribeUserRoomsQueueOptions,
): () => void {
  const sub = client.subscribe("/user/queue/rooms", (message) => {
    const parsed = parseUserRoomQueueMessage(message.body);
    if (!parsed) return;

    if (parsed.kind === "forced_exit") {
      options.notifyForcedRoomExit(
        parsed.reason,
        parsed.roomId,
        parsed.message,
      );
      return;
    }

    dispatchHostJoinRequestFromStomp(
      options.queryClientRef.current,
      parsed.roomId,
      parsed.nickname,
    );
  });
  resyncUserQueueDataAfterSubscribe(options.queryClientRef.current);

  return () => {
    sub.unsubscribe();
  };
}
