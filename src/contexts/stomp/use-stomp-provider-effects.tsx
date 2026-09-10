"use client";

import type { MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";

import { createStompClient, getStompBrokerURL } from "@/lib/stomp/client";
import { pathDefersRoomStompRoomTopics } from "@/lib/stomp/stompPathPolicy";
import {
  handleStompReconnect,
  STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE,
} from "@/lib/stomp/stomp-session-recovery";
import { startSessionPresencePing } from "@/lib/stomp/sessionPresencePing";
import { subscribeUserRoomsQueue } from "@/lib/stomp/subscribe-user-rooms-queue";
import type { ForcedRoomExitReason } from "@/lib/stomp/user-room-queue";
import { useStompConnectionStore } from "@/stores/stomp-connection-store";

export type StompConnectionState = {
  client: Client | null;
  connected: boolean;
};

type LifecycleOpts = {
  stompEligible: boolean;
  suppressCloseRecoveryRef: MutableRefObject<boolean>;
  notifyForcedRoomExit: (
    reason: ForcedRoomExitReason,
    eventRoomId: string,
    message?: string,
  ) => void;
  subscribeToRoomTopics: (client: Client, roomId: string) => void;
  invalidateRoomTopics: () => void;
  teardownConnectedClient: () => void;
  clientRef: MutableRefObject<Client | null>;
  userRoomsQueueUnsubRef: MutableRefObject<(() => void) | null>;
  getResolvedRoomId: () => string | null;
  pathnameRef: MutableRefObject<string>;
  forcedExitConsumedRef: MutableRefObject<boolean>;
  queryClientRef: MutableRefObject<QueryClient>;
  setConnectionState: Dispatch<SetStateAction<StompConnectionState>>;
};

/**
 * 로그인·경로 조건으로 STOMP 클라이언트 1개를 유지하고, 재연결 시 유저 방 큐 구독을 세팅합니다.
 */
export function useStompClientLifecycleEffect({
  stompEligible,
  suppressCloseRecoveryRef,
  notifyForcedRoomExit,
  subscribeToRoomTopics,
  invalidateRoomTopics,
  teardownConnectedClient,
  clientRef,
  userRoomsQueueUnsubRef,
  getResolvedRoomId,
  pathnameRef,
  forcedExitConsumedRef,
  queryClientRef,
  setConnectionState,
}: LifecycleOpts): void {
  useEffect(() => {
    if (!stompEligible) {
      useStompConnectionStore.getState().clearConnectionIssue();
      teardownConnectedClient();
      setConnectionState({ client: null, connected: false });
      return;
    }

    suppressCloseRecoveryRef.current = false;

    const stopPingRef: { current: (() => void) | null } = { current: null };
    let effectActive = true;

    const stopAppPing = () => {
      stopPingRef.current?.();
      stopPingRef.current = null;
    };

    const client = createStompClient(getStompBrokerURL());
    clientRef.current = client;
    setConnectionState({ client, connected: false });

    const isActive = () => effectActive;
    const isSuppressed = () => suppressCloseRecoveryRef.current;

    const requestStompRecovery = () => {
      if (!effectActive || suppressCloseRecoveryRef.current) return;

      stopAppPing();
      setConnectionState((prev) => ({ ...prev, connected: false }));
      invalidateRoomTopics();

      void handleStompReconnect({
        client,
        queryClient: queryClientRef.current,
        isSuppressed,
        isActive,
      });
    };

    client.onConnect = () => {
      if (!effectActive) return;
      useStompConnectionStore.getState().clearConnectionIssue();
      setConnectionState({ client, connected: true });
      forcedExitConsumedRef.current = false;

      stopAppPing();
      stopPingRef.current = startSessionPresencePing(client);

      userRoomsQueueUnsubRef.current?.();
      userRoomsQueueUnsubRef.current = subscribeUserRoomsQueue(client, {
        queryClientRef,
        notifyForcedRoomExit,
      });

      const rid = getResolvedRoomId();
      if (rid && !pathDefersRoomStompRoomTopics(pathnameRef.current)) {
        subscribeToRoomTopics(client, rid);
      }
    };

    client.onDisconnect = () => {
      if (!effectActive) return;
      requestStompRecovery();
    };

    client.onStompError = () => {
      if (!effectActive) return;
      setConnectionState((prev) => ({ ...prev, connected: false }));
    };

    client.onWebSocketClose = (event) => {
      if (!effectActive) return;
      if (suppressCloseRecoveryRef.current) return;

      if (event.code === STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE) {
        console.debug("[stomp] WebSocket closed: ACCESS_TOKEN_EXPIRED (4001)");
      }

      requestStompRecovery();
    };

    client.activate();

    return () => {
      effectActive = false;
      stopAppPing();
      teardownConnectedClient();
    };
  }, [
    clientRef,
    forcedExitConsumedRef,
    pathnameRef,
    queryClientRef,
    setConnectionState,
    userRoomsQueueUnsubRef,
    getResolvedRoomId,
    invalidateRoomTopics,
    notifyForcedRoomExit,
    stompEligible,
    subscribeToRoomTopics,
    suppressCloseRecoveryRef,
    teardownConnectedClient,
  ]);
}

type RoomTopicsOpts = {
  /** `/home` 등 방 토픽을 미루는 경로 여부 — plan↔bookmark 탭 전환과 분리 */
  roomTopicsDeferred: boolean;
  resolvedRoomId: string | null;
  connected: boolean;
  clientRef: MutableRefObject<Client | null>;
  detachRoomTopicsOnly: () => void;
  subscribeToRoomTopics: (client: Client, roomId: string) => void;
  unsubscribeRoomTopics: () => void;
};

/** 방·`/home` 경계·roomId 변경 시에만 방 토픽 구독을 맞춥니다. */
export function useStompRoomTopicsResyncEffect({
  roomTopicsDeferred,
  resolvedRoomId,
  connected,
  clientRef,
  detachRoomTopicsOnly,
  subscribeToRoomTopics,
  unsubscribeRoomTopics,
}: RoomTopicsOpts): void {
  useEffect(() => {
    const client = clientRef.current;
    if (!client?.connected || !connected) return;

    if (roomTopicsDeferred) {
      detachRoomTopicsOnly();
      return;
    }

    if (resolvedRoomId) {
      subscribeToRoomTopics(client, resolvedRoomId);
    } else {
      unsubscribeRoomTopics();
    }
  }, [
    clientRef,
    connected,
    resolvedRoomId,
    roomTopicsDeferred,
    detachRoomTopicsOnly,
    subscribeToRoomTopics,
    unsubscribeRoomTopics,
  ]);
}
