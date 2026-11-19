"use client";

import type { MutableRefObject } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";

import { validateRoomAccess } from "@/lib/rooms";
import {
  createStompClient,
  getStompBrokerURL,
  STOMP_MAX_RECONNECT_ATTEMPTS,
  STOMP_MAX_RECONNECT_DELAY_MS,
} from "@/lib/stomp/client";
import { pathDefersRoomStompRoomTopics } from "@/lib/stomp/stompPathPolicy";
import {
  refreshSessionBeforeReconnect,
  STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE,
} from "@/lib/stomp/stomp-session-recovery";
import { startSessionPresencePing } from "@/lib/stomp/sessionPresencePing";
import { subscribeUserRoomsQueue } from "@/lib/stomp/subscribe-user-rooms-queue";
import type { ForcedRoomExitReason } from "@/lib/stomp/user-room-queue";
import {
  STOMP_CONNECTION_ISSUE_MESSAGE,
  useStompConnectionStore,
} from "@/stores/stomp-connection-store";

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
  notifyRoomAccessLost: (roomId: string) => void;
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
  retryConnectionRef: MutableRefObject<(() => void) | null>;
};

export function useStompClientLifecycleEffect({
  stompEligible,
  suppressCloseRecoveryRef,
  notifyForcedRoomExit,
  notifyRoomAccessLost,
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
  retryConnectionRef,
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
    let connectionDropped = false;
    let attemptInFlight = false;
    let reconnectAttempts = 0;
    let closingAfterStompError = false;
    let stompErrorReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let accessCheckRoomId: string | null = null;

    const stopAppPing = () => {
      stopPingRef.current?.();
      stopPingRef.current = null;
    };

    const clearStompErrorReconnectTimer = () => {
      if (stompErrorReconnectTimer === null) return;
      clearTimeout(stompErrorReconnectTimer);
      stompErrorReconnectTimer = null;
    };

    const client = createStompClient(getStompBrokerURL());
    clientRef.current = client;
    setConnectionState({ client, connected: false });

    const isActive = () => effectActive && !suppressCloseRecoveryRef.current;

    const confirmRoomAccess = (roomId: string) => {
      if (accessCheckRoomId === roomId) return;
      accessCheckRoomId = roomId;
      void validateRoomAccess(roomId).then((verdict) => {
        accessCheckRoomId = null;
        if (!isActive() || verdict !== "forbidden") return;
        notifyRoomAccessLost(roomId);
      });
    };

    client.beforeConnect = async () => {
      attemptInFlight = true;
      if (!connectionDropped) return;
      reconnectAttempts += 1;
      await refreshSessionBeforeReconnect({
        client,
        queryClient: queryClientRef.current,
        isActive,
      });
    };

    retryConnectionRef.current = () => {
      if (!isActive() || attemptInFlight || client.connected) return;
      clearStompErrorReconnectTimer();
      reconnectAttempts = 0;
      void client.deactivate().then(() => {
        if (isActive()) client.activate();
      });
    };

    client.onConnect = () => {
      if (!effectActive) return;
      attemptInFlight = false;
      closingAfterStompError = false;
      reconnectAttempts = 0;
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

    client.onStompError = () => {
      if (!effectActive) return;
      closingAfterStompError = true;
      setConnectionState((prev) => ({ ...prev, connected: false }));
      const rid = getResolvedRoomId()?.trim();
      if (rid) confirmRoomAccess(rid);
    };

    client.onWebSocketClose = (event) => {
      attemptInFlight = false;
      if (!isActive()) return;

      if (event.code === STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE) {
        console.debug("[stomp] WebSocket closed: ACCESS_TOKEN_EXPIRED (4001)");
      }

      connectionDropped = true;
      stopAppPing();
      setConnectionState((prev) => ({ ...prev, connected: false }));
      invalidateRoomTopics();

      if (reconnectAttempts >= STOMP_MAX_RECONNECT_ATTEMPTS) {
        closingAfterStompError = false;
        clearStompErrorReconnectTimer();
        void client.deactivate();
        useStompConnectionStore
          .getState()
          .setConnectionIssue(STOMP_CONNECTION_ISSUE_MESSAGE);
        return;
      }

      if (closingAfterStompError) {
        closingAfterStompError = false;
        void client.deactivate();
        clearStompErrorReconnectTimer();
        stompErrorReconnectTimer = setTimeout(() => {
          stompErrorReconnectTimer = null;
          if (isActive()) client.activate();
        }, STOMP_MAX_RECONNECT_DELAY_MS);
      }
    };

    client.activate();

    return () => {
      effectActive = false;
      retryConnectionRef.current = null;
      clearStompErrorReconnectTimer();
      stopAppPing();
      teardownConnectedClient();
    };
  }, [
    clientRef,
    forcedExitConsumedRef,
    pathnameRef,
    queryClientRef,
    retryConnectionRef,
    setConnectionState,
    userRoomsQueueUnsubRef,
    getResolvedRoomId,
    invalidateRoomTopics,
    notifyForcedRoomExit,
    notifyRoomAccessLost,
    stompEligible,
    subscribeToRoomTopics,
    suppressCloseRecoveryRef,
    teardownConnectedClient,
  ]);
}

export function useStompOnlineRetryEffect(
  retryConnectionRef: MutableRefObject<(() => void) | null>,
): void {
  useEffect(() => {
    const retry = () => retryConnectionRef.current?.();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [retryConnectionRef]);
}

type RoomTopicsOpts = {
  roomTopicsDeferred: boolean;
  resolvedRoomId: string | null;
  connected: boolean;
  clientRef: MutableRefObject<Client | null>;
  detachRoomTopicsOnly: () => void;
  subscribeToRoomTopics: (client: Client, roomId: string) => void;
  unsubscribeRoomTopics: () => void;
};

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
