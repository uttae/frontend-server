"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { newestServerMessageByCreatedAt } from "@/lib/chat";
import { optimisticallyClearRoomUnreadCount, publishRoomMessageRead } from "@/lib/chat/message-read";
import { useStompContext } from "@/contexts/StompContext";
import type { ServerChatMessage } from "@/types/chat";

export type UseChatMessageReadOptions = {
  roomId: string | null;
  panelOpen: boolean;
  rawMessagesRef: RefObject<ServerChatMessage[]>;
};

export function useChatMessageRead({ roomId, panelOpen, rawMessagesRef }: UseChatMessageReadOptions) {
  const queryClient = useQueryClient();
  const { client, connected } = useStompContext();

  const lastPublishedReadIdRef = useRef<string | null>(null);
  const panelOpenRef = useRef(panelOpen);
  const markMessagesReadRef = useRef<(messageId?: string) => void>(() => {});
  const stompRef = useRef({ client, connected });

  useLayoutEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  useLayoutEffect(() => {
    stompRef.current = { client, connected };
  }, [client, connected]);

  const markMessagesRead = useCallback(
    (messageId?: string) => {
      const rid = roomId?.trim();
      const stomp = stompRef.current;
      if (!rid || !stomp.client || !stomp.connected) return;

      const id = messageId?.trim() || newestServerMessageByCreatedAt(rawMessagesRef.current)?.id;
      if (!id || id === lastPublishedReadIdRef.current) return;

      lastPublishedReadIdRef.current = id;
      publishRoomMessageRead(stomp.client, rid, id);
      optimisticallyClearRoomUnreadCount(queryClient, rid);
    },
    [roomId, queryClient, rawMessagesRef],
  );

  useLayoutEffect(() => {
    markMessagesReadRef.current = markMessagesRead;
  }, [markMessagesRead]);

  const resetReadDedup = useCallback(() => {
    lastPublishedReadIdRef.current = null;
  }, []);

  const onIncomingMessage = useCallback((_msg: ServerChatMessage, isNew: boolean) => {
    if (!isNew) return;
    if (panelOpenRef.current) {
      markMessagesReadRef.current(_msg.id);
      return;
    }
  }, []);

  useLayoutEffect(() => {
    lastPublishedReadIdRef.current = null;
  }, [roomId]);

  return {
    markMessagesRead,
    resetReadDedup,
    onIncomingMessage,
  };
}
