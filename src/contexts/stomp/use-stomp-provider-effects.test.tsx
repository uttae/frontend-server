// @vitest-environment jsdom
import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";
import { afterEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import {
  STOMP_CONNECTION_ISSUE_MESSAGE,
  useStompConnectionStore,
} from "@/stores/stomp-connection-store";
import {
  useStompClientLifecycleEffect,
  useStompOnlineRetryEffect,
  useStompRoomTopicsResyncEffect,
} from "./use-stomp-provider-effects";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  ping: vi.fn(),
  queue: vi.fn(),
  stop: vi.fn(),
  refresh: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/lib/stomp/client", () => ({
  createStompClient: mocks.create,
  getStompBrokerURL: () => "http://fixture.invalid/ws",
  STOMP_MAX_RECONNECT_ATTEMPTS: 7,
  STOMP_MAX_RECONNECT_DELAY_MS: 30_000,
}));
vi.mock("@/lib/rooms", () => ({
  validateRoomAccess: mocks.validate,
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
const PROTOCOL_ERROR_CLOSE = { code: 1002 };
const RECONNECT_CAP_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 7;

type FakeClient = {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
  connected: boolean;
  beforeConnect: () => Promise<void>;
  onConnect: (frame: typeof CONNECTED_FRAME) => void;
  onStompError: () => void;
  onWebSocketClose: (event: { code: number }) => void;
};

function fakeClient(connected = false): FakeClient {
  return {
    activate: vi.fn(),
    deactivate: vi.fn(() => Promise.resolve()),
    connected,
    beforeConnect: () => Promise.resolve(),
    onConnect: () => {},
    onStompError: () => {},
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
    notifyRoomAccessLost: vi.fn(),
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

/** 끊긴 뒤 재연결 시도와 실패를 count번 겪게 한다 */
async function failReconnects(client: FakeClient, count: number) {
  for (let i = 0; i < count; i += 1) {
    await client.beforeConnect();
    client.onWebSocketClose(ABNORMAL_CLOSE);
  }
}

it("stops reconnecting and shows the banner once the last allowed attempt fails", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onWebSocketClose(ABNORMAL_CLOSE);
  await failReconnects(client, MAX_RECONNECT_ATTEMPTS - 1);
  expect(client.deactivate).not.toHaveBeenCalled();
  expect(useStompConnectionStore.getState().connectionIssue).toBeNull();

  await failReconnects(client, 1);
  expect(client.deactivate).toHaveBeenCalledTimes(1);
  expect(useStompConnectionStore.getState().connectionIssue).toBe(
    STOMP_CONNECTION_ISSUE_MESSAGE,
  );

  client.onConnect(CONNECTED_FRAME);
  expect(useStompConnectionStore.getState().connectionIssue).toBeNull();
  await hook.unmount();
});

it("counts attempts again from zero after the connection recovers", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onWebSocketClose(ABNORMAL_CLOSE);
  await failReconnects(client, MAX_RECONNECT_ATTEMPTS - 1);
  await client.beforeConnect();
  client.onConnect(CONNECTED_FRAME);

  client.onWebSocketClose(ABNORMAL_CLOSE);
  await failReconnects(client, MAX_RECONNECT_ATTEMPTS - 1);

  expect(client.deactivate).not.toHaveBeenCalled();
  expect(useStompConnectionStore.getState().connectionIssue).toBeNull();
  await hook.unmount();
});

it("gives the retry button a fresh round of attempts after reconnecting stopped", async () => {
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onWebSocketClose(ABNORMAL_CLOSE);
  await failReconnects(client, MAX_RECONNECT_ATTEMPTS);
  expect(client.deactivate).toHaveBeenCalledTimes(1);

  opts.retryConnectionRef.current?.();
  await hook.flush();
  expect(client.deactivate).toHaveBeenCalledTimes(2);
  expect(client.activate).toHaveBeenCalledTimes(2);

  await failReconnects(client, MAX_RECONNECT_ATTEMPTS - 1);
  expect(client.deactivate).toHaveBeenCalledTimes(2);
  await hook.unmount();
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

it("reconnects right away when the browser reports the network is back", async () => {
  const retry = vi.fn();
  const retryConnectionRef = { current: retry as (() => void) | null };
  const hook = hookHarness(() => useStompOnlineRetryEffect(retryConnectionRef));
  await hook.render(undefined);

  window.dispatchEvent(new Event("online"));
  expect(retry).toHaveBeenCalledTimes(1);

  await hook.unmount();
  window.dispatchEvent(new Event("online"));
  expect(retry).toHaveBeenCalledTimes(1);
});

it("does not restart reconnecting on online once it stopped and the banner is shown", async () => {
  const retry = vi.fn();
  const retryConnectionRef = { current: retry as (() => void) | null };
  const hook = hookHarness(() => useStompOnlineRetryEffect(retryConnectionRef));
  await hook.render(undefined);
  useStompConnectionStore.setState({ connectionIssue: STOMP_CONNECTION_ISSUE_MESSAGE });

  window.dispatchEvent(new Event("online"));

  expect(retry).not.toHaveBeenCalled();
  await hook.unmount();
});

it("exits the room when a subscription error turns out to be lost access", async () => {
  mocks.validate.mockResolvedValue("forbidden");
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onStompError();
  client.onStompError();
  await hook.flush();

  expect(mocks.validate).toHaveBeenCalledTimes(1);
  expect(mocks.validate).toHaveBeenCalledWith("a");
  expect(opts.notifyRoomAccessLost).toHaveBeenCalledWith("a");
  await hook.unmount();
});

it("keeps the room when access is still valid after a subscription error", async () => {
  mocks.validate.mockResolvedValue("ok");
  const client = fakeClient();
  const opts = lifecycleOpts(client);
  const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
  await hook.render(undefined);

  client.onStompError();
  await hook.flush();

  expect(opts.notifyRoomAccessLost).not.toHaveBeenCalled();
  await hook.unmount();
});

it("waits the capped delay before reconnecting after the server closes on a subscription error", async () => {
  vi.useFakeTimers();
  try {
    mocks.validate.mockResolvedValue("ok");
    const client = fakeClient();
    const opts = lifecycleOpts(client);
    const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
    await hook.render(undefined);

    client.onStompError();
    client.onWebSocketClose(PROTOCOL_ERROR_CLOSE);
    // 라이브러리 재연결을 멈춰야 CONNECTED 때 초기화되는 1초 간격으로 반복하지 않는다
    expect(client.deactivate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RECONNECT_CAP_MS - 1);
    expect(client.activate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.activate).toHaveBeenCalledTimes(2);
    await hook.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("leaves an ordinary close to the stompjs reconnect", async () => {
  vi.useFakeTimers();
  try {
    const client = fakeClient();
    const opts = lifecycleOpts(client);
    const hook = hookHarness(() => useStompClientLifecycleEffect(opts));
    await hook.render(undefined);

    client.onWebSocketClose(ABNORMAL_CLOSE);
    await vi.advanceTimersByTimeAsync(RECONNECT_CAP_MS);

    expect(client.deactivate).not.toHaveBeenCalled();
    expect(client.activate).toHaveBeenCalledTimes(1);
    expect(mocks.validate).not.toHaveBeenCalled();
    await hook.unmount();
  } finally {
    vi.useRealTimers();
  }
});
