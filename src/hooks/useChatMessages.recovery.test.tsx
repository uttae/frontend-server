// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { HttpError } from "@/lib/api/errors";
import type { InitialRoomHistoryLoadResult } from "@/lib/chat/initialRoomHistory";
import type { ServerChatMessage } from "@/types/chat";
import { useChatMessages } from "./useChatMessages";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  initial: vi.fn(),
  read: vi.fn(),
  publish: vi.fn(),
  stomp: {
    connected: true,
    handler: null as ((msg: ServerChatMessage) => void) | null,
  },
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 1 } }),
}));
vi.mock("@/hooks/useRooms", () => ({
  useRoomMembers: () => ({ data: { members: [] } }),
}));
vi.mock("@/hooks/useChatActions", () => ({ useChatActions: () => ({}) }));
vi.mock("@/contexts/StompContext", () => {
  const client = { publish: mocks.publish };
  const setRoomChatMessageHandler = (
    fn: ((msg: ServerChatMessage) => void) | null,
  ) => {
    mocks.stomp.handler = fn;
  };
  return {
    useStompContext: () => ({
      client,
      connected: mocks.stomp.connected,
      setRoomChatMessageHandler,
    }),
  };
});
vi.mock("@/lib/api/rooms", () => ({
  getRoomMessageReadStatus: mocks.read,
  getRoomMessages: mocks.history,
}));
vi.mock("@/lib/chat/initialRoomHistory", () => ({
  loadInitialRoomHistory: mocks.initial,
  hasOlderHistoryPage: (count: number, size: number) => count >= size,
}));
vi.mock("@/lib/places/warmChatHistoryPlacePhotos", () => ({
  warmPlacePhotoQueriesFromChatHistory: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ROOM = "room";

function message(
  sequence: number,
  overrides: Partial<ServerChatMessage> = {},
): ServerChatMessage {
  return {
    roomId: ROOM,
    id: `m${sequence}`,
    senderId: 2,
    messageType: "CHAT",
    content: `m${sequence}`,
    createdAt: new Date(Date.UTC(2026, 9, 25, 0, 0, sequence)).toISOString(),
    sequence,
    ...overrides,
  };
}

function range(from: number, to: number): ServerChatMessage[] {
  return Array.from({ length: to - from + 1 }, (_, i) => message(from + i));
}

function snapshot(
  serverSlice: ServerChatMessage[],
  overrides: Partial<InitialRoomHistoryLoadResult> = {},
): InitialRoomHistoryLoadResult {
  return {
    serverSlice,
    hasMoreOlder: false,
    hasMoreNewer: false,
    lastReadMessageId: null,
    warmHistory: [],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const queryClient = new QueryClient();
let hook: ReturnType<typeof mountHook>;

function mountHook() {
  return hookHarness(
    (roomId: string | null) => useChatMessages(roomId, { fetchHistory: true }),
    (child) => (
      <QueryClientProvider client={queryClient}>{child}</QueryClientProvider>
    ),
  );
}

const ids = () => hook.current.messages.map((m) => m.id);

const lastPublishedRead = () => {
  const body = mocks.publish.mock.calls[mocks.publish.mock.calls.length - 1]?.[0]?.body;
  return body ? JSON.parse(body).lastReadMessageId : null;
};

async function receive(...msgs: ServerChatMessage[]) {
  await act(async () => {
    for (const msg of msgs) mocks.stomp.handler?.(msg);
  });
}

async function reconnect() {
  mocks.stomp.connected = false;
  await hook.render(ROOM);
  mocks.stomp.connected = true;
  await hook.render(ROOM);
  await hook.flush();
}

beforeEach(async () => {
  mocks.stomp.connected = true;
  mocks.read.mockResolvedValue({ lastReadMessageId: null });
  hook = mountHook();
});

afterEach(async () => {
  await hook.unmount();
  queryClient.clear();
  vi.resetAllMocks();
});

describe("while the first history loads", () => {
  it("keeps chat messages received before the snapshot arrives", async () => {
    const load = deferred<InitialRoomHistoryLoadResult>();
    mocks.initial.mockReturnValueOnce(load.promise);
    await hook.render(ROOM);

    await receive(message(41));
    await act(async () => load.resolve(snapshot(range(39, 40))));

    expect(ids()).toEqual(["m39", "m40", "m41"]);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("keeps an AI request canceled during the load instead of the queued snapshot", async () => {
    const queued = message(40, {
      id: "ai",
      messageType: "AI_REQUEST",
      metadata: { aiStatus: "QUEUED", cancelable: "true" },
    });
    const canceled = {
      ...queued,
      metadata: { aiStatus: "CANCELED", cancelable: "false" },
    };
    const load = deferred<InitialRoomHistoryLoadResult>();
    mocks.initial.mockReturnValueOnce(load.promise);
    await hook.render(ROOM);

    await receive(canceled);
    await act(async () => load.resolve(snapshot([message(39), queued])));

    const ai = hook.current.messages.find((m) => m.id === "ai");
    expect(ai?.aiRequest?.aiStatus).toBe("CANCELED");
  });

  it("finishes the load when the connection drops and returns, then catches up", async () => {
    const load = deferred<InitialRoomHistoryLoadResult>();
    mocks.initial.mockReturnValueOnce(load.promise);
    await hook.render(ROOM);

    await reconnect();
    mocks.history.mockResolvedValueOnce([message(41)]);
    await act(async () => load.resolve(snapshot(range(39, 40))));
    await hook.flush();

    expect(mocks.initial).toHaveBeenCalledTimes(1);
    expect(mocks.history).toHaveBeenCalledWith(ROOM, {
      afterSequence: "40",
      size: 200,
    });
    expect(ids()).toEqual(["m39", "m40", "m41"]);
  });

  it("loads the history again after reconnecting when the load gave up", async () => {
    mocks.read.mockRejectedValueOnce(new HttpError(400, "rejected"));
    mocks.initial.mockResolvedValueOnce(snapshot(range(39, 40)));
    await hook.render(ROOM);
    expect(ids()).toEqual([]);

    await reconnect();

    expect(ids()).toEqual(["m39", "m40"]);
  });
});

describe("after the history is loaded", () => {
  beforeEach(async () => {
    mocks.initial.mockResolvedValueOnce(snapshot(range(39, 40)));
    await hook.render(ROOM);
  });

  it("catches up a missing sequence once and marks it read after it is shown", async () => {
    const catchUp = deferred<ServerChatMessage[]>();
    mocks.history.mockReturnValueOnce(catchUp.promise);

    await receive(message(41), message(43));
    await receive(message(44));
    expect(lastPublishedRead()).toBe("m41");
    await act(async () => catchUp.resolve([message(42), message(43)]));

    expect(ids()).toEqual(["m39", "m40", "m41", "m42", "m43", "m44"]);
    expect(mocks.history).toHaveBeenCalledTimes(1);
    expect(mocks.history).toHaveBeenCalledWith(ROOM, {
      afterSequence: "41",
      size: 200,
    });
    expect(lastPublishedRead()).toBe("m44");
  });

  it("asks once after reconnecting even when nothing was missed", async () => {
    mocks.history.mockResolvedValueOnce([]);

    await reconnect();

    expect(mocks.history).toHaveBeenCalledTimes(1);
    expect(mocks.history).toHaveBeenCalledWith(ROOM, {
      afterSequence: "40",
      size: 200,
    });
    expect(ids()).toEqual(["m39", "m40"]);
    expect(hook.current.readDividerPlacement).toBeNull();
  });

  it("pages through a long disconnection and marks where the missed messages start", async () => {
    mocks.history
      .mockResolvedValueOnce(range(41, 240))
      .mockResolvedValueOnce(range(241, 440))
      .mockResolvedValueOnce(range(441, 450));

    await reconnect();

    expect(hook.current.messages).toHaveLength(412);
    expect(
      mocks.history.mock.calls.map(([, params]) => params.afterSequence),
    ).toEqual(["40", "240", "440"]);
    expect(hook.current.readDividerPlacement).toEqual({
      afterMessageId: "m40",
      beforeFirst: false,
    });
    expect(hook.current.scrollToAnchor?.anchorId).toBe("m40");
  });

  it("does not append live messages to a middle window", async () => {
    await hook.render(null);
    mocks.initial.mockResolvedValueOnce(
      snapshot(range(39, 40), { hasMoreNewer: true }),
    );
    await hook.render(ROOM);

    await receive(message(41), message(40, { content: "edited" }));

    expect(ids()).toEqual(["m39", "m40"]);
    expect(hook.current.messages[1]?.text).toBe("edited");
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("stops catching up when the room rejects the request", async () => {
    mocks.history.mockRejectedValue(new HttpError(403, "forbidden"));

    await receive(message(42));
    await hook.flush();

    expect(mocks.history).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(["m39", "m40"]);
  });

  it("catches up a room after coming back from another room", async () => {
    mocks.initial.mockResolvedValueOnce(snapshot([]));
    await hook.render("other");
    mocks.history.mockResolvedValueOnce([message(41)]);

    await hook.render(ROOM);
    await hook.flush();

    expect(mocks.history).toHaveBeenCalledWith(ROOM, {
      afterSequence: "40",
      size: 200,
    });
    expect(ids()).toEqual(["m39", "m40", "m41"]);
  });
});

describe("in an empty room", () => {
  it("loads the latest page instead of asking for afterSequence=0", async () => {
    mocks.initial.mockResolvedValueOnce(snapshot([]));
    await hook.render(ROOM);
    mocks.history.mockResolvedValueOnce(range(1, 2));

    await reconnect();

    expect(mocks.history).toHaveBeenCalledWith(ROOM, { size: 15 });
    expect(ids()).toEqual(["m1", "m2"]);
  });
});
