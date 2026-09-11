import type { Client } from "@stomp/stompjs";
import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";

import type { ServerChatMessage } from "@/types/chat";
import { normalizeServerChatMessage } from "@/lib/chat";
import { invalidateRoomUnreadCount } from "@/lib/chat/message-read";
import { applyRoomBookmarkStompMessage } from "@/lib/stomp/bookmarks-dispatch";
import { parseRoomPresenceMessage } from "@/lib/stomp/events";
import { parseRoomMemberMessage } from "@/lib/stomp/member-events";
import { dispatchRoomMemberEvent } from "@/lib/stomp/members-dispatch";
import {
  dispatchRoomPresence,
  optimisticPatchSelfOnline,
  scheduleRoomMembersResyncAfterSubscribe,
} from "@/lib/stomp/presence-dispatch";
import { parseRoomScheduleMessage } from "@/lib/stomp/schedule-events";
import { dispatchRoomScheduleEvent } from "@/lib/stomp/schedules-dispatch";
import { dispatchUserError } from "@/lib/stomp/user-error-dispatch";
import { parseUserErrorMessage } from "@/lib/stomp/user-error-events";
export type RoomTopicsUnsubscriber = () => void;

export type SubscribeRoomStompTopicsOptions = {
  onRoomChatMessage?: (msg: ServerChatMessage) => void;
};

/** 방 단위 members·presence·bookmarks·schedules + messages + 개인 에러 큐(`/user/queue/errors`) 구독; 반환값으로 한 번에 해제 */
export function subscribeRoomStompTopics(
  client: Client,
  roomId: string,
  queryClientRef: MutableRefObject<QueryClient>,
  options: SubscribeRoomStompTopicsOptions,
): RoomTopicsUnsubscriber {
  const subscribedRoomId = roomId.trim();

  const membersSub = client.subscribe(
    `/topic/rooms/${subscribedRoomId}/members`,
    (message) => {
      const event = parseRoomMemberMessage(message.body);
      if (!event) return;
      dispatchRoomMemberEvent(queryClientRef.current, subscribedRoomId, event);
    },
  );

  const presenceSub = client.subscribe(
    `/topic/rooms/${subscribedRoomId}/presence`,
    (message) => {
      const event = parseRoomPresenceMessage(message.body);
      if (!event) return;
      dispatchRoomPresence(queryClientRef.current, subscribedRoomId, event);
    },
  );

  const bookmarksSub = client.subscribe(
    `/topic/rooms/${subscribedRoomId}/bookmarks`,
    (message) => {
      void (async () => {
        try {
          await applyRoomBookmarkStompMessage(
            queryClientRef.current,
            message.body,
          );
        } catch {
          // malformed payload / 네트워크 — 무시
        }
      })();
    },
  );

  const schedulesSub = client.subscribe(
    `/topic/rooms/${subscribedRoomId}/schedules`,
    (message) => {
      void (async () => {
        const event = parseRoomScheduleMessage(message.body);
        if (!event) return;
        await dispatchRoomScheduleEvent(queryClientRef.current, event);
      })();
    },
  );

  const userErrorsSub = client.subscribe(`/user/queue/errors`, (message) => {
    const payload = parseUserErrorMessage(message.body);
    if (!payload) return;
    dispatchUserError(payload);
  });

  const messagesSub = client.subscribe(
    `/topic/rooms/${subscribedRoomId}/messages`,
    (message) => {
      try {
        const parsed: unknown = JSON.parse(message.body);
        const msg = normalizeServerChatMessage(parsed);
        if (!msg) return;
        invalidateRoomUnreadCount(queryClientRef.current, subscribedRoomId);
        options.onRoomChatMessage?.(msg);
      } catch {
        // malformed payload — ignore
      }
    },
  );

  optimisticPatchSelfOnline(queryClientRef.current, subscribedRoomId);
  scheduleRoomMembersResyncAfterSubscribe(
    queryClientRef.current,
    subscribedRoomId,
  );

  return () => {
    membersSub.unsubscribe();
    presenceSub.unsubscribe();
    bookmarksSub.unsubscribe();
    schedulesSub.unsubscribe();
    userErrorsSub.unsubscribe();
    messagesSub.unsubscribe();
  };
}
