import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import type { RoomMember, RoomMemberListResponse } from "@/lib/api/rooms";
import { roomMembersQueryKey, sessionUserQueryKey } from "@/lib/query-keys";
import type { RoomPresenceChangedEvent } from "@/lib/stomp/events";

import { dispatchRoomPresence, optimisticPatchSelfOnline } from "./presence-dispatch";

const ROOM_ID = "room";
const KEY = roomMembersQueryKey(ROOM_ID);

const member = (userId: number, patch: Partial<RoomMember> = {}): RoomMember => ({
  userId,
  nickname: `user-${userId}`,
  profileImageUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
  joinedAt: "2026-10-25T00:00:00Z",
  isOnline: false,
  ...patch,
});

const connected = (userId: number): RoomPresenceChangedEvent => ({
  type: "USER_CONNECTED",
  userId,
  roomId: ROOM_ID,
  nickname: null,
  profileImageUrl: null,
});

const onlineOf = (client: QueryClient) =>
  client.getQueryData<RoomMemberListResponse>(KEY)?.members.map((m) => [m.userId, m.isOnline]);

const clients: QueryClient[] = [];
const stops: (() => void)[] = [];

function newClient(data?: RoomMemberListResponse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  if (data) client.setQueryData(KEY, data);
  return client;
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  for (const client of clients.splice(0)) client.clear();
});

describe("dispatchRoomPresence", () => {
  it("접속한 멤버의 isOnline만 GET 없이 고친다", () => {
    const client = newClient({ members: [member(1), member(2)] });

    dispatchRoomPresence(client, ROOM_ID, connected(2));

    expect(onlineOf(client)).toEqual([[1, false], [2, true]]);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
  });

  it("나간 멤버와 목록에 없는 사용자는 고치지 않는다", () => {
    const client = newClient({ members: [member(1, { status: "LEFT" })] });
    const before = client.getQueryData(KEY);

    dispatchRoomPresence(client, ROOM_ID, connected(1));
    dispatchRoomPresence(client, ROOM_ID, connected(3));

    expect(client.getQueryData(KEY)).toBe(before);
  });

  it("목록을 받은 적이 없으면 만들지 않는다", () => {
    const client = newClient();

    dispatchRoomPresence(client, ROOM_ID, connected(1));

    expect(client.getQueryData(KEY)).toBeUndefined();
  });

  it("다시 받을 표시가 남은 목록은 고치지 않아 재조회가 사라지지 않는다", async () => {
    const client = newClient({ members: [member(1)] });
    await client.invalidateQueries({ queryKey: KEY, refetchType: "none" });

    dispatchRoomPresence(client, ROOM_ID, connected(1));

    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    expect(onlineOf(client)).toEqual([[1, false]]);
  });

  it("받는 중인 목록이 있으면 고치지 않고 다시 받아, 접속 전에 출발한 응답이 접속 상태를 덮지 않는다", async () => {
    const client = newClient({ members: [member(1), member(2)] });
    const responses: ((value: RoomMemberListResponse) => void)[] = [];
    const observer = new QueryObserver(client, {
      queryKey: KEY,
      queryFn: () => new Promise<RoomMemberListResponse>((resolve) => responses.push(resolve)),
      staleTime: Infinity,
    });
    stops.push(observer.subscribe(() => {}));

    // 2번이 접속하기 전에 출발한 조회
    void observer.refetch();
    await expect.poll(() => responses.length).toBe(1);

    dispatchRoomPresence(client, ROOM_ID, connected(2));
    await expect.poll(() => responses.length).toBe(2);

    responses[1]!({ members: [member(1), member(2, { isOnline: true })] });
    responses[0]!({ members: [member(1), member(2)] });

    await expect.poll(() => onlineOf(client)).toEqual([[1, false], [2, true]]);
  });
});

describe("optimisticPatchSelfOnline", () => {
  it("구독 직후 본인을 접속 중으로 표시한다", () => {
    const client = newClient({ members: [member(1), member(2)] });
    client.setQueryData(sessionUserQueryKey, { id: 1, nickname: "나", profileImageUrl: null });

    optimisticPatchSelfOnline(client, ROOM_ID);

    expect(onlineOf(client)).toEqual([[1, true], [2, false]]);
  });
});
