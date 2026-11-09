import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import type {
  RoomDetail,
  RoomListResponse,
  RoomMember,
  RoomMemberListResponse,
} from "@/lib/api/rooms";
import { expenseKeys } from "@/lib/expenses/expense-queries";
import {
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
  sessionUserQueryKey,
} from "@/lib/query-keys";
import { resolveViewerIsHost } from "@/lib/rooms";
import type { RoomMemberPayload } from "@/lib/stomp/member-events";
import { dispatchRoomMemberEvent } from "@/lib/stomp/members-dispatch";

const ROOM_ID = "room";
const KEY = roomMembersQueryKey(ROOM_ID);
const ME = 1;

const member = (userId: number, role: RoomMember["role"] = "MEMBER"): RoomMember => ({
  userId,
  nickname: `user-${userId}`,
  profileImageUrl: null,
  role,
  status: "ACTIVE",
  joinedAt: "2026-10-25T00:00:00Z",
  isOnline: false,
});

const base = { id: "event", roomId: ROOM_ID, createdAt: "2026-10-25T00:00:00Z" };
const joined = (userId: number): RoomMemberPayload => ({
  ...base,
  type: "MEMBER_JOINED",
  detail: { userId, nickname: `user-${userId}` },
});
const removed = (type: "MEMBER_LEFT" | "MEMBER_KICKED", userId: number): RoomMemberPayload => ({
  ...base,
  type,
  detail: { userId },
});
const delegated = (previousHostUserId: number, newHostUserId: number): RoomMemberPayload => ({
  ...base,
  type: "HOST_DELEGATED",
  detail: { previousHostUserId, newHostUserId },
});

const clients: QueryClient[] = [];
const stops: (() => void)[] = [];

function newClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  client.setQueryData(sessionUserQueryKey, { id: ME, nickname: "나", profileImageUrl: null });
  return client;
}

/** 화면에 있는 조회처럼 observer를 붙인다. 응답은 `respond`가 정한다 */
function watch<T>(client: QueryClient, queryKey: readonly unknown[], respond: () => Promise<T>) {
  let fetches = 0;
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: () => {
      fetches += 1;
      return respond();
    },
    staleTime: Infinity,
  });
  stops.push(observer.subscribe(() => {}));
  return { fetches: () => fetches };
}

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  for (const client of clients.splice(0)) client.clear();
});

describe("dispatchRoomMemberEvent", () => {
  it("다른 사람의 입장은 목록을 고치지 않고 다시 받는다", async () => {
    const client = newClient();
    client.setQueryData<RoomMemberListResponse>(KEY, { members: [member(ME)] });
    client.setQueryData(expenseKeys.members(ROOM_ID), []);
    const members = watch(client, KEY, async () => ({ members: [member(ME), member(2)] }));

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));

    await expect.poll(() => members.fetches()).toBe(1);
    await expect
      .poll(() => client.getQueryData<RoomMemberListResponse>(KEY)?.members.map((m) => m.userId))
      .toEqual([ME, 2]);
    expect(client.getQueryState(expenseKeys.members(ROOM_ID))?.isInvalidated).toBe(true);
  });

  it("이벤트 전에 출발한 조회가 늦게 와도 그 응답으로 덮지 않는다", async () => {
    const client = newClient();
    client.setQueryData<RoomMemberListResponse>(KEY, { members: [member(ME)] });
    const responses: ((value: RoomMemberListResponse) => void)[] = [];
    watch(client, KEY, () => new Promise<RoomMemberListResponse>((resolve) => responses.push(resolve)));

    // 이벤트 전 조회(2번 입장 전 상태를 받아 올 조회)
    void client.refetchQueries({ queryKey: KEY });
    await expect.poll(() => responses.length).toBe(1);

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));
    await expect.poll(() => responses.length).toBe(2);

    responses[1]!({ members: [member(ME), member(2)] });
    responses[0]!({ members: [member(ME)] });

    await expect
      .poll(() => client.getQueryData<RoomMemberListResponse>(KEY)?.members.map((m) => m.userId))
      .toEqual([ME, 2]);
  });

  it("첫 목록을 받는 중에 온 입장도, 그 첫 조회를 버리고 새로 받은 목록을 쓴다", async () => {
    const client = newClient();
    const responses: ((value: RoomMemberListResponse) => void)[] = [];
    watch(client, KEY, () => new Promise<RoomMemberListResponse>((resolve) => responses.push(resolve)));
    // 마운트하자마자 나간 첫 조회(2번 입장 전 상태를 받아 올 조회)
    await expect.poll(() => responses.length).toBe(1);

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));
    await expect.poll(() => responses.length).toBe(2);

    responses[1]!({ members: [member(ME), member(2)] });
    responses[0]!({ members: [member(ME)] });

    await expect
      .poll(() => client.getQueryData<RoomMemberListResponse>(KEY)?.members.map((m) => m.userId))
      .toEqual([ME, 2]);
  });

  it("목록을 받은 적이 없으면 한 명짜리 목록을 만들지 않는다", () => {
    const client = newClient();

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));

    expect(client.getQueryData(KEY)).toBeUndefined();
  });

  it.each(["MEMBER_LEFT", "MEMBER_KICKED"] as const)(
    "다른 사람의 %s는 다시 받는다",
    (type) => {
      const client = newClient();
      client.setQueryData<RoomMemberListResponse>(KEY, { members: [member(ME), member(2)] });

      dispatchRoomMemberEvent(client, ROOM_ID, removed(type, 2));

      expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    },
  );

  it.each(["MEMBER_LEFT", "MEMBER_KICKED"] as const)(
    "내 %s는 다시 받지 않는다 — 나간 방의 조회는 403이고, 방 캐시는 나가기·강퇴 처리가 지운다",
    (type) => {
      const client = newClient();
      client.setQueryData<RoomMemberListResponse>(KEY, { members: [member(ME), member(2)] });
      client.setQueryData(expenseKeys.members(ROOM_ID), []);
      const members = watch(client, KEY, async () => ({ members: [] }));

      dispatchRoomMemberEvent(client, ROOM_ID, removed(type, ME));

      expect(members.fetches()).toBe(0);
      expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
      expect(client.getQueryState(expenseKeys.members(ROOM_ID))?.isInvalidated).toBe(false);
    },
  );

  it("방장 위임을 받으면 다른 탭의 이전 방장도 방장이 아니게 된다(세 출처 모두 다시 받음)", async () => {
    const client = newClient();
    // 이 탭은 이전 방장(나)이고, 위임은 다른 탭에서 했다 — 세 출처 모두 HOST가 남아 있다
    client.setQueryData<RoomMemberListResponse>(KEY, { members: [member(ME, "HOST"), member(2)] });
    client.setQueryData<RoomDetail>(roomDetailQueryKey(ROOM_ID), {
      id: ROOM_ID, title: "여행", destinations: [], startDate: null, endDate: null,
      inviteCode: "CODE", memberCount: 2, role: "HOST", createdAt: "",
    });
    client.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, {
      rooms: [{ id: ROOM_ID, title: "여행", destinations: [], startDate: null, endDate: null, role: "HOST", joinedAt: "" }],
      nextCursor: null,
      hasNext: false,
    });
    watch(client, KEY, async () => ({ members: [member(ME), member(2, "HOST")] }));
    watch(client, roomDetailQueryKey(ROOM_ID), async () => ({
      ...client.getQueryData<RoomDetail>(roomDetailQueryKey(ROOM_ID))!,
      role: "MEMBER",
    }));
    watch(client, ROOMS_QUERY_KEY, async () => {
      const prev = client.getQueryData<RoomListResponse>(ROOMS_QUERY_KEY)!;
      return { ...prev, rooms: prev.rooms.map((r) => ({ ...r, role: "MEMBER" })) };
    });

    dispatchRoomMemberEvent(client, ROOM_ID, delegated(ME, 2));

    const viewerIsHost = () =>
      resolveViewerIsHost({
        listRole: client.getQueryData<RoomListResponse>(ROOMS_QUERY_KEY)?.rooms[0]?.role,
        detailRole: client.getQueryData<RoomDetail>(roomDetailQueryKey(ROOM_ID))?.role,
        memberRole: client
          .getQueryData<RoomMemberListResponse>(KEY)
          ?.members.find((m) => m.userId === ME)?.role,
      });
    await expect.poll(viewerIsHost).toBe(false);
  });
});
