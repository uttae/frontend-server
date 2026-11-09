// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import type { InitialRoomHistoryLoadResult } from "@/lib/chat/initialRoomHistory";
import type { ServerChatMessage } from "@/types/chat";
import { useChatMessages } from "./useChatMessages";

type Member = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  role: "HOST" | "MEMBER";
  status: "ACTIVE" | "LEFT";
  joinedAt: string;
  isOnline: boolean;
};

const mocks = vi.hoisted(() => ({
  initial: vi.fn(),
  read: vi.fn(),
  getMembers: vi.fn(),
  stomp: { handler: null as ((msg: ServerChatMessage) => void) | null },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/plan/room" }));
vi.mock("@/hooks/useSessionUser", () => ({ useSessionUser: () => ({ data: { id: 1 } }) }));
vi.mock("@/hooks/useChatActions", () => ({ useChatActions: () => ({}) }));
vi.mock("@/contexts/StompContext", () => {
  const client = { publish: vi.fn() };
  const setRoomChatMessageHandler = (fn: ((msg: ServerChatMessage) => void) | null) => {
    mocks.stomp.handler = fn;
  };
  return { useStompContext: () => ({ client, connected: true, setRoomChatMessageHandler }) };
});
// 멤버 목록은 실제 useRoomMembers(TanStack)로 받는다 — 무효화가 같은 렌더에 반영되는지 보려고
vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRoomMessageReadStatus: mocks.read,
  getRoomMessages: vi.fn(),
  getRoomMembers: mocks.getMembers,
}));
vi.mock("@/lib/chat/initialRoomHistory", () => ({
  loadInitialRoomHistory: mocks.initial,
  hasOlderHistoryPage: (count: number, size: number) => count >= size,
}));
vi.mock("@/lib/places/warmChatHistoryPlacePhotos", () => ({ warmPlacePhotoQueriesFromChatHistory: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ROOM = "room";
const member = (userId: number, nickname: string): Member => ({
  userId, nickname, profileImageUrl: null, role: "MEMBER", status: "ACTIVE", joinedAt: "", isOnline: true,
});
const me = member(1, "나");
const friend = member(2, "친구");
const newcomer = member(9, "강신규");
const at = (second: number) => new Date(Date.UTC(2026, 10, 8, 6, 0, second)).toISOString();
const chat = (id: string, senderId: number, second: number): ServerChatMessage => ({
  roomId: ROOM, id, senderId, messageType: "CHAT", content: id, createdAt: at(second), sequence: second,
});
const joined: ServerChatMessage = {
  roomId: ROOM,
  id: "join-9",
  senderId: 0,
  messageType: "SYSTEM",
  content: "",
  createdAt: at(10),
  sequence: 10,
  metadata: { eventType: "MEMBER_JOINED", userId: "9" },
};
const history = (serverSlice: ServerChatMessage[]): InitialRoomHistoryLoadResult => ({
  serverSlice,
  hasMoreOlder: false,
  hasMoreNewer: false,
  lastReadMessageId: null,
  warmHistory: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let queryClient: QueryClient;
let hook: ReturnType<typeof mountHook>;
function mountHook() {
  return hookHarness(
    (roomId: string | null) => useChatMessages(roomId, { fetchHistory: true }),
    (child) => <QueryClientProvider client={queryClient}>{child}</QueryClientProvider>,
  );
}
const shown = () => hook.current.messages.map((m) => [m.id, m.type === "system" ? m.text : m.sender]);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.read.mockResolvedValue({ lastReadMessageId: null });
  mocks.initial.mockResolvedValue(history([]));
  mocks.getMembers.mockResolvedValue({ members: [me, friend] });
  hook = mountHook();
});

afterEach(async () => {
  await hook.unmount();
  queryClient.clear();
  vi.resetAllMocks();
});

it("멤버 목록에 없는 사람의 메시지는 목록을 다시 받는 동안 그리지 않다가, 제자리에 이름과 함께 보인다", async () => {
  await hook.render(ROOM);
  await hook.flush();
  const refetch = deferred<{ members: Member[] }>();
  mocks.getMembers.mockReturnValueOnce(refetch.promise);

  await act(async () => {
    mocks.stomp.handler?.(chat("before", 2, 5));
    mocks.stomp.handler?.(joined);
    mocks.stomp.handler?.(chat("after", 2, 20));
  });

  // 받자마자 목록을 다시 받기 시작했고, 그 렌더에서 이미 숨겨져 '(알 수 없음)'이 잠깐도 보이지 않는다
  expect(mocks.getMembers).toHaveBeenCalledTimes(2);
  expect(shown()).toEqual([["before", "친구"], ["after", "친구"]]);

  await act(async () => refetch.resolve({ members: [me, friend, newcomer] }));
  await hook.flush();

  // messages state는 그대로이고, 목록이 바뀌어 같은 계산이 이름을 그린다
  expect(shown()).toEqual([
    ["before", "친구"],
    ["join-9", "강신규님이 입장했어요"],
    ["after", "친구"],
  ]);
});

it("다시 받은 목록에도 없으면 (알 수 없음)으로 보인다", async () => {
  await hook.render(ROOM);
  await hook.flush();

  await act(async () => {
    mocks.stomp.handler?.(joined);
  });
  await hook.flush();

  expect(shown()).toEqual([["join-9", "(알 수 없음)님이 입장했어요"]]);
});

it("이미 있던 메시지의 사람이 목록에 없으면(탈퇴) 다른 이유로 다시 받는 중에도 숨기지 않는다", async () => {
  mocks.initial.mockResolvedValue(history([chat("old", 7, 1)]));
  await hook.render(ROOM);
  await hook.flush();
  expect(shown()).toEqual([["old", "(알 수 없음)"]]);

  mocks.getMembers.mockReturnValueOnce(new Promise(() => {}));
  await act(async () => {
    void queryClient.invalidateQueries({ queryKey: ["room-members", ROOM] });
  });

  expect(shown()).toEqual([["old", "(알 수 없음)"]]);
});

it("멤버 목록을 처음 받는 중이면 로딩 상태이고, 이름을 모르는 메시지는 그리지 않는다", async () => {
  const firstLoad = deferred<{ members: Member[] }>();
  mocks.getMembers.mockReturnValueOnce(firstLoad.promise);
  mocks.initial.mockResolvedValue(history([chat("mine", 1, 1), chat("theirs", 2, 2)]));
  await hook.render(ROOM);
  await hook.flush();
  expect(hook.current.waitingForMembers).toBe(true);
  expect(hook.current.messages.map((m) => m.id)).toEqual(["mine"]);

  await act(async () => firstLoad.resolve({ members: [me, friend] }));
  await hook.flush();
  expect(hook.current.waitingForMembers).toBe(false);
  expect(shown()).toEqual([["mine", "나"], ["theirs", "친구"]]);
});

it("첫 멤버 목록을 받는 중에 새 멤버가 들어와도, 그 사람이 있는 새 목록으로 이름이 보인다", async () => {
  const firstLoad = deferred<{ members: Member[] }>();
  const refetch = deferred<{ members: Member[] }>();
  mocks.getMembers.mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(refetch.promise);
  await hook.render(ROOM);
  await hook.flush();

  await act(async () => {
    mocks.stomp.handler?.(joined);
  });
  // 첫 조회에 합류하지 않고 새로 받기 시작했다
  expect(mocks.getMembers).toHaveBeenCalledTimes(2);

  await act(async () => {
    refetch.resolve({ members: [me, friend, newcomer] });
    // 입장 전에 출발한 첫 응답이 늦게 와도 버려진다
    firstLoad.resolve({ members: [me, friend] });
  });
  await hook.flush();

  expect(shown()).toEqual([["join-9", "강신규님이 입장했어요"]]);
});
