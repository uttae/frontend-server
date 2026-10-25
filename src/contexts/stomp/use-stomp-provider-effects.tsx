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
  STOMP_CONNECTION_ISSUE_DELAY_MS,
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
  /** 연결 문제 배너의 '다시 시도'가 부르는 즉시 재연결 */
  retryConnectionRef: MutableRefObject<(() => void) | null>;
};

/**
 * 로그인·경로 조건으로 STOMP 클라이언트 1개를 유지하고, 재연결 시 유저 방 큐 구독을 세팅합니다.
 * 재연결 간격은 stompjs(`createStompClient`)가 맡고, 이 effect는 재연결 직전 세션 갱신과 연결 상태 표시만 합니다.
 */
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
    // 첫 연결은 proxy가 세션을 확인했으므로, 한 번이라도 끊긴 뒤의 시도에서만 세션을 갱신한다
    let connectionDropped = false;
    // 연결 시도(세션 확인~CONNECTED·close) 중에 다시 시도하면 연결이 둘로 갈라진다
    let attemptInFlight = false;
    let connectionIssueTimer: ReturnType<typeof setTimeout> | null = null;
    // 서버는 구독 거부 등으로 ERROR를 보낸 뒤 연결을 닫는다(Spring 기본 동작)
    let closingAfterStompError = false;
    let stompErrorReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let accessCheckRoomId: string | null = null;

    const stopAppPing = () => {
      stopPingRef.current?.();
      stopPingRef.current = null;
    };

    const clearConnectionIssueTimer = () => {
      if (connectionIssueTimer === null) return;
      clearTimeout(connectionIssueTimer);
      connectionIssueTimer = null;
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

    // ERROR 프레임은 원인과 상관없이 같은 문구라 강퇴인지 서버 장애인지 알 수 없다. 그래서 방 접근을 HTTP로 확인한다
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
      await refreshSessionBeforeReconnect({
        client,
        queryClient: queryClientRef.current,
        isActive,
      });
    };

    retryConnectionRef.current = () => {
      if (!isActive() || attemptInFlight || client.connected) return;
      clearStompErrorReconnectTimer();
      // deactivate→activate는 예약된 재연결을 지우고 간격을 처음 값으로 되돌린 뒤 바로 시도한다
      void client.deactivate().then(() => {
        if (isActive()) client.activate();
      });
    };

    client.onConnect = () => {
      if (!effectActive) return;
      attemptInFlight = false;
      closingAfterStompError = false;
      clearConnectionIssueTimer();
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
      // 끊긴 동안 강퇴·방 삭제 알림을 놓친 방에 다시 구독하면 서버가 ERROR로 거부한다
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

      // stompjs는 CONNECTED를 받을 때마다 간격을 처음 값으로 되돌려, 구독 오류로 닫히는 연결은 1초마다 다시 붙는다.
      // 이 경우만 라이브러리 재연결을 멈추고 상한 간격 뒤에 다시 연결한다(문서 밖 보강)
      if (closingAfterStompError) {
        closingAfterStompError = false;
        void client.deactivate();
        clearStompErrorReconnectTimer();
        stompErrorReconnectTimer = setTimeout(() => {
          stompErrorReconnectTimer = null;
          if (isActive()) client.activate();
        }, STOMP_MAX_RECONNECT_DELAY_MS);
      }

      // 끊긴 상태가 이어질 때만 배너를 띄운다
      if (connectionIssueTimer === null) {
        connectionIssueTimer = setTimeout(() => {
          connectionIssueTimer = null;
          if (!isActive() || client.connected) return;
          useStompConnectionStore
            .getState()
            .setConnectionIssue(STOMP_CONNECTION_ISSUE_MESSAGE);
        }, STOMP_CONNECTION_ISSUE_DELAY_MS);
      }
    };

    client.activate();

    return () => {
      effectActive = false;
      retryConnectionRef.current = null;
      clearConnectionIssueTimer();
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

/** 브라우저가 네트워크 복귀를 알리면 다음 재연결 예약(최대 5초)을 기다리지 않고 바로 다시 연결합니다. */
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
