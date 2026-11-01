import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import type { RoomMember, RoomMemberListResponse } from "@/lib/api/rooms";
import { roomMembersQueryKey } from "@/lib/query-keys";
import type { RoomMemberPayload } from "@/lib/stomp/member-events";
import { dispatchRoomMemberEvent } from "@/lib/stomp/members-dispatch";
import { dispatchRoomPresence } from "@/lib/stomp/presence-dispatch";

const ROOM_ID = "room";
const KEY = roomMembersQueryKey(ROOM_ID);

const member = (userId: number, isOnline = false): RoomMember => ({
  userId,
  nickname: `user-${userId}`,
  profileImageUrl: null,
  role: "MEMBER",
  status: "ACTIVE",
  joinedAt: "2026-10-25T00:00:00Z",
  isOnline,
});

const joined = (userId: number): RoomMemberPayload => ({
  type: "MEMBER_JOINED",
  id: `event-${userId}`,
  roomId: ROOM_ID,
  createdAt: "2026-10-25T00:00:00Z",
  detail: { userId, nickname: `user-${userId}` },
});

const clients: QueryClient[] = [];
function clientWith(data?: RoomMemberListResponse) {
  const client = new QueryClient();
  clients.push(client);
  if (data) client.setQueryData(KEY, data);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe("member cache patches", () => {
  it("applies a member event to a valid list", () => {
    const client = clientWith({ members: [member(1)] });

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));

    expect(client.getQueryData<RoomMemberListResponse>(KEY)?.members.map((m) => m.userId)).toEqual([1, 2]);
  });

  it("keeps the pending refetch of a list invalidated while off screen", async () => {
    const client = clientWith({ members: [member(1)] });
    await client.invalidateQueries({ queryKey: KEY, refetchType: "none" });

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));
    dispatchRoomPresence(client, ROOM_ID, {
      type: "USER_CONNECTED",
      userId: 1,
      roomId: ROOM_ID,
      nickname: null,
      profileImageUrl: null,
    });

    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryData(KEY)).toEqual({ members: [member(1)] });
  });

  it("does not build a partial list before the member list was ever loaded", () => {
    const client = clientWith();

    dispatchRoomMemberEvent(client, ROOM_ID, joined(2));

    expect(client.getQueryData(KEY)).toBeUndefined();
  });
});
