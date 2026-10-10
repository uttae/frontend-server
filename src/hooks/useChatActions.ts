"use client";

import { useCallback } from "react";

import { useStompContext } from "@/contexts/StompContext";
import { isChatSendBlocked } from "@/stores/chat-rate-limit-store";
import { useSessionStore } from "@/stores/session-store";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import type { PlaceShareData } from "@/types/chat";

/**
 * STOMP publish helpers — `useChatMessages` 외부(예: 검색 페이지)에서도 사용 가능.
 * 모든 publish 는 현재 세션의 `currentRoomId` 를 자동 사용하므로 외부에선 인자만 넘기면 된다.
 */
export function useChatActions() {
  const { client, connected } = useStompContext();
  const roomId = useSessionStore((s) => s.currentRoomId);

  const ridTrimmed =
    typeof roomId === "string" ? roomId.trim() : "";
  const canSend = Boolean(client && connected && ridTrimmed);

  const sendChatMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (
        !client ||
        !connected ||
        !ridTrimmed ||
        !trimmed ||
        isChatSendBlocked()
      ) {
        return;
      }
      client.publish({
        destination: `/app/rooms/${ridTrimmed}/messages/chat`,
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          content: trimmed,
        }),
      });
      trackAnalyticsEvent(AnalyticsEvents.chatMessageSent, {
        room_id: ridTrimmed,
        message_type: "text",
      });
    },
    [client, connected, ridTrimmed],
  );

  const sendAiMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (
        !client ||
        !connected ||
        !ridTrimmed ||
        !trimmed ||
        isChatSendBlocked()
      ) {
        return;
      }
      client.publish({
        destination: `/app/rooms/${ridTrimmed}/messages/ai`,
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          content: trimmed,
        }),
      });
      trackAnalyticsEvent(AnalyticsEvents.chatMessageSent, {
        room_id: ridTrimmed,
        message_type: "ai",
      });
    },
    [client, connected, ridTrimmed],
  );

  const sendPlaceMessage = useCallback(
    (place: PlaceShareData) => {
      if (!client || !connected || !ridTrimmed || isChatSendBlocked()) return;
      client.publish({
        destination: `/app/rooms/${ridTrimmed}/messages/place`,
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          formattedAddress: place.formattedAddress,
          googlePlaceId: place.googlePlaceId,
          latitude: place.latitude,
          longitude: place.longitude,
          name: place.name,
          rating: place.rating,
        }),
      });
      trackAnalyticsEvent(AnalyticsEvents.chatMessageSent, {
        room_id: ridTrimmed,
        message_type: "place",
      });
    },
    [client, connected, ridTrimmed],
  );

  const sendCancelAiRequest = useCallback(
    (requestMessageId: string) => {
      const id = requestMessageId.trim();
      if (!client || !connected || !ridTrimmed || !id) return;
      client.publish({
        destination: `/app/rooms/${ridTrimmed}/messages/ai/cancel`,
        body: JSON.stringify({ requestMessageId: id }),
      });
    },
    [client, connected, ridTrimmed],
  );

  return {
    canSend,
    sendChatMessage,
    sendAiMessage,
    sendPlaceMessage,
    sendCancelAiRequest,
  };
}
