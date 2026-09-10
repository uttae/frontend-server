// @vitest-environment jsdom
import { act } from "react";
import { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";
import { expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import {
  useStompClientLifecycleEffect,
  useStompRoomTopicsResyncEffect,
} from "./use-stomp-provider-effects";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  ping: vi.fn(),
  queue: vi.fn(),
  stop: vi.fn(),
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
  handleStompReconnect: vi.fn(),
  STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE: 4001,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("stable dependencies keep one client and pathname/room resync uses current committed refs", async () => {
  const client = {
    activate: vi.fn(),
    connected: true,
    onConnect: () => {},
    onWebSocketClose: () => {},
  } as unknown as Client;
  mocks.create.mockReturnValue(client);
  mocks.ping.mockReturnValue(mocks.stop);
  mocks.queue.mockReturnValue(vi.fn());
  const subscribe = vi.fn();
  const teardown = vi.fn();
  const detach = vi.fn();
  const opts = {
    stompEligible: true,
    suppressCloseRecoveryRef: { current: false },
    notifyForcedRoomExit: vi.fn(),
    subscribeToRoomTopics: subscribe,
    invalidateRoomTopics: vi.fn(),
    teardownConnectedClient: teardown,
    clientRef: { current: null as Client | null },
    userRoomsQueueUnsubRef: { current: null as (() => void) | null },
    getResolvedRoomId: () => "a",
    pathnameRef: { current: "/plan/a" },
    forcedExitConsumedRef: { current: false },
    queryClientRef: { current: new QueryClient() },
    setConnectionState: vi.fn(),
  };
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
  await act(async () =>
    client.onConnect({
      command: "CONNECTED",
      headers: {},
      body: "",
      isBinaryBody: false,
      binaryBody: new Uint8Array(),
    }),
  );
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
