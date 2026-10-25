// @vitest-environment jsdom
import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import {
  STOMP_CONNECTION_ISSUE_DELAY_MS,
  STOMP_CONNECTION_ISSUE_MESSAGE,
  useStompConnectionStore,
} from "@/stores/stomp-connection-store";
import {
  useStompClientLifecycleEffect,
  useStompRoomTopicsResyncEffect,
} from "./use-stomp-provider-effects";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  ping: vi.fn(),
  queue: vi.fn(),
  stop: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/stomp/client", () => ({
  createStompClient: mocks.create,
  getStompBrokerURL: () => "http://fixture.invalid/ws",
}));
vi.mock("@/lib/stomp/sessionPresencePing", () => ({
  startSessionPresencePing: mocks.ping,
}));
vi.mock("@/lib/stomp/subscribe-user-rooms-queue", () => ({
  subscribeUserRoomsQueue: mocks.queue,
}));
vi.mock("@/lib/stomp/stomp-session-recovery", () => ({
  refreshSessionBeforeReconnect: mocks.refresh,
  STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE: 4001,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CONNECTED_FRAME = {
  command: "CONNECTED",
  headers: {},
  body: "",
  isBinaryBody: false,
  binaryBody: new Uint8Array(),
};
const ABNORMAL_CLOSE = { code: 1006 };

type FakeClient = {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  connected: boolean;
  beforeConnect: () => Promise<void>;
  onConnect: (frame: typeof CONNECTED_FRAME) => void;
  onWebSocketClose: (event: { code: number }) => void;
};

function fakeClient(connected = false): FakeClient {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(() => Promise.resolve()),
    connected,
    beforeConnect: () => Promise.resolve(),
    onConnect: () => {},
    onWebSocketClose: () => {},
  };
}

function lifecycleOpts(client: FakeClient) {
  mocks.create.mockReturnValue(client);
  mocks.ping.mockReturnValue(mocks.stop);
  mocks.queue.mockReturnValue(vi.fn());
  return {
    stompEligible: true,
    suppressCloseRecoveryRef: { current: false },
    notifyForcedRoomExit: vi.fn(),
    subscribeToRoomTopics: vi.fn(),
    invalidateRoomTopics: vi.fn(),
    teardownConnectedClient: vi.fn(),
    clientRef: { current: null as Client | null },
    userRoomsQueueUnsubRef: { current: null as (() => void) | null },
    getResolvedRoomId: () => "a",
    pathnameRef: { current: "/plan/a" },
    forcedExitConsumedRef: { current: false },
    queryClientRef: { current: new QueryClient() },
    setConnectionState: vi.fn(),
    retryConnectionRef: { current: null as (() => void) | null },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  useStompConnectionStore.setState({ connectionIssue: null });
});

it("stable dependencies keep one client and pathname/room resync uses current committed refs", async () => {
  const client = fakeClient(true);
  const opts = lifecycleOpts(client);
  const subscribe = opts.subscribeToRoomTopics;
  const teardown = opts.teardownConnectedClient;
  const detach = vi.fn();
  const hook = hookHarness((p: { room: string; deferred: boolean }) => {
    useStompClientLifecycleEffect(opts);
    useStompRoomTopicsResyncEffect({
      roomTopicsDeferred: p.deferred,
      resolvedRoomId: p.room,
      connected: true,
      clientRef: opts.clientRef,
      detachRoomTopicsOnly: detach,
      subscribeToRoomTopics: subscribe,
      unsubscribeRoomTopics: teardown,
    });
  });
  await hook.render({ room: "a", deferred: false });
  await act(async () => client.onConnect(CONNECTED_FRAME));
  await hook.render({ room: "b", deferred: false });
  expect(subscribe.mock.lastCall?.[1]).toBe("b");
  await hook.render({ room: "b", deferred: true });
  expect(detach).toHaveBeenCalledTimes(1);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(client.activate).toHaveBeenCalledTimes(1);
  await hook.unmount();
  expect(teardown).toHaveBeenCalledTimes(1);
  expect(mocks.stop).toHaveBeenCalled();
  opts.queryClientRef.current.clear();
});

it("leaves reconnecting to stompjs when the socket closes", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onWebSocketClose(ABNORMAL_CLOSE);

  expect(client.activate).toHaveBeenCalledTimes(1);
  expect(client.deactivate).not.toHaveBeenCalled();
  expect(opts.invalidateRoomTopics).toHaveBeenCalledTimes(1);
  await hook.unmount();
});

it("refreshes the session only before attempts that follow a dropped connection", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  await client.beforeConnect();
  expect(mocks.refresh).not.toHaveBeenCalled();

  client.onWebSocketClose(ABNORMAL_CLOSE);
  await client.beforeConnect();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.refresh.mock.lastCall?.[0].isActive()).toBe(true);

  await hook.unmount();
  expect(mocks.refresh.mock.lastCall?.[0].isActive()).toBe(false);
});

it("shows the connection banner only after staying disconnected and clears it on connect", async () => {
  vi.useFakeTimers();
  try {
    const client = fakeClient();
    const opts = lifecycleOpts(client);
    const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
    await hook.render(undefined);

    client.onWebSocketClose(ABNORMAL_CLOSE);
    // 재연결 시도가 다시 실패해도 배너 기준 시각은 처음 끊긴 때다
    await vi.advanceTimersByTimeAsync(STOMP_CONNECTION_ISSUE_DELAY_MS / 2);
    client.onWebSocketClose(ABNORMAL_CLOSE);
    await vi.advanceTimersByTimeAsync(STOMP_CONNECTION_ISSUE_DELAY_MS / 2 - 1);
    expect(useStompConnectionStore.getState().connectionIssue).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(useStompConnectionStore.getState().connectionIssue).toBe(
      STOMP_CONNECTION_ISSUE_MESSAGE,
    );

    client.onConnect(CONNECTED_FRAME);
    expect(useStompConnectionStore.getState().connectionIssue).toBeNull();
    await hook.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("does not show the banner when the connection recovers in time", async () => {
  vi.useFakeTimers();
  try {
    const client = fakeClient();
    const opts = lifecycleOpts(client);
    const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
    await hook.render(undefined);

    client.onWebSocketClose(ABNORMAL_CLOSE);
    await vi.advanceTimersByTimeAsync(1_000);
    client.onConnect(CONNECTED_FRAME);
    await vi.advanceTimersByTimeAsync(STOMP_CONNECTION_ISSUE_DELAY_MS);

    expect(useStompConnectionStore.getState().connectionIssue).toBeNull();
    await hook.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("retries immediately unless a connection attempt is in flight", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  await client.beforeConnect();
  opts.retryConnectionRef.current?.();
  expect(client.deactivate).not.toHaveBeenCalled();

  client.onWebSocketClose(ABNORMAL_CLOSE);
  opts.retryConnectionRef.current?.();
  await hook.flush();
  expect(client.deactivate).toHaveBeenCalledTimes(1);
  expect(client.activate).toHaveBeenCalledTimes(2);

  await hook.unmount();
  expect(opts.retryConnectionRef.current).toBeNull();
});
