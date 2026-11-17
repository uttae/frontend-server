// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import {
  bookmarkCategoriesQueryKey,
  joinRequestsQueryKey,
  ROOMS_QUERY_KEY,
  roomAllBookmarksQueryKey,
  roomDetailQueryKey,
  roomMembersQueryKey,
} from "@/lib/query-keys";
import {
  useApproveJoinRequest,
  useDeleteRoomBookmarkItem,
  useKickMember,
  useRejectJoinRequest,
  useTransferHost,
} from "./useRooms";

const api = vi.hoisted(() => ({
  kick: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  transfer: vi.fn(),
  deleteBookmark: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/plan/room" }));
vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  kickMember: api.kick,
  approveJoinRequest: api.approve,
  rejectJoinRequest: api.reject,
  transferHost: api.transfer,
  deleteRoomBookmark: api.deleteBookmark,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ROOM = "room";
let client: QueryClient;
let hook: ReturnType<typeof mountHook>;
const stops: (() => void)[] = [];

function mountHook() {
  return hookHarness(
    () => ({
      kick: useKickMember(),
      approve: useApproveJoinRequest(),
      reject: useRejectJoinRequest(),
      transfer: useTransferHost(),
      deleteItem: useDeleteRoomBookmarkItem(),
    }),
    (child) => <QueryClientProvider client={client}>{child}</QueryClientProvider>,
  );
}

/** 화면에 붙은 조회처럼 observer를 붙이고, 다시 받을 때의 응답은 테스트가 풀 때까지 붙잡는다 */
function watchRefetch(queryKey: readonly unknown[]) {
  let finish: (() => void) | undefined;
  client.setQueryData(queryKey, []);
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => new Promise<unknown[]>((resolve) => { finish = () => resolve([]); }),
    staleTime: Infinity,
  });
  stops.push(observer.subscribe(() => {}));
  return { finish: () => finish?.() };
}

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  hook = mountHook();
  await hook.render(undefined);
});

afterEach(async () => {
  for (const stop of stops.splice(0)) stop();
  await hook.unmount();
  client.clear();
  vi.resetAllMocks();
});

describe("응답 본문이 없는 변경은 목록을 다시 받을 때까지 끝나지 않는다(진행 표시 유지)", () => {
  it.each([
    ["강퇴", () => hook.current.kick.mutateAsync({ roomId: ROOM, userId: 2 }), api.kick, roomMembersQueryKey(ROOM)],
    ["입장 승인", () => hook.current.approve.mutateAsync({ roomId: ROOM, requestId: 1 }), api.approve, joinRequestsQueryKey(ROOM)],
    ["입장 거절", () => hook.current.reject.mutateAsync({ roomId: ROOM, requestId: 1 }), api.reject, joinRequestsQueryKey(ROOM)],
    ["북마크 삭제", () => hook.current.deleteItem.mutateAsync({ roomId: ROOM, bookmarkId: 10, categoryId: 1 }), api.deleteBookmark, roomAllBookmarksQueryKey(ROOM)],
  ] as const)("%s", async (_name, run, request, queryKey) => {
    request.mockResolvedValueOnce(undefined);
    const list = watchRefetch(queryKey);
    let done = false;

    await act(async () => {
      void run().then(() => { done = true; });
    });
    expect(done).toBe(false);

    await act(async () => list.finish());
    expect(done).toBe(true);
  });
});

describe("실패해도 서버 기준으로 다시 맞춘다", () => {
  it.each([
    ["강퇴", () => hook.current.kick.mutateAsync({ roomId: ROOM, userId: 2 }), api.kick, [roomMembersQueryKey(ROOM), ROOMS_QUERY_KEY]],
    ["입장 승인", () => hook.current.approve.mutateAsync({ roomId: ROOM, requestId: 1 }), api.approve, [joinRequestsQueryKey(ROOM), roomMembersQueryKey(ROOM), ROOMS_QUERY_KEY]],
    ["입장 거절", () => hook.current.reject.mutateAsync({ roomId: ROOM, requestId: 1 }), api.reject, [joinRequestsQueryKey(ROOM)]],
    ["방장 위임", () => hook.current.transfer.mutateAsync({ roomId: ROOM, targetUserId: 2 }), api.transfer, [roomMembersQueryKey(ROOM), roomDetailQueryKey(ROOM), ROOMS_QUERY_KEY]],
    ["북마크 삭제", () => hook.current.deleteItem.mutateAsync({ roomId: ROOM, bookmarkId: 10, categoryId: 1 }), api.deleteBookmark, [bookmarkCategoriesQueryKey(ROOM), roomAllBookmarksQueryKey(ROOM)]],
  ] as const)("%s", async (_name, run, request, queryKeys) => {
    request.mockRejectedValueOnce(new Error("offline"));
    for (const queryKey of queryKeys) client.setQueryData(queryKey, []);

    await act(async () => {
      await expect(run()).rejects.toThrow("offline");
    });

    for (const queryKey of queryKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
  });
});
