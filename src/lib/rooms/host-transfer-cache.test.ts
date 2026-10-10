import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { RoomDetail, RoomListResponse, RoomMemberListResponse } from "@/lib/api/rooms";
import { ROOMS_QUERY_KEY, roomDetailQueryKey, roomMembersQueryKey } from "@/lib/query-keys";
import { resolveViewerIsHost } from "@/lib/rooms";

import { applyHostTransferToCache } from "./host-transfer-cache";

const ROOM = "room-1";

function seeded() {
  const qc = new QueryClient();
  qc.setQueryData<RoomMemberListResponse>(roomMembersQueryKey(ROOM), {
    members: [
      { userId: 1, nickname: "나", profileImageUrl: null, role: "HOST", status: "ACTIVE", joinedAt: "", isOnline: true },
      { userId: 2, nickname: "대상", profileImageUrl: null, role: "MEMBER", status: "ACTIVE", joinedAt: "", isOnline: true },
      { userId: 3, nickname: "다른", profileImageUrl: null, role: "MEMBER", status: "ACTIVE", joinedAt: "", isOnline: false },
    ],
  });
  qc.setQueryData<RoomDetail>(roomDetailQueryKey(ROOM), {
    id: ROOM, title: "여행", destinations: [], startDate: null, endDate: null,
    inviteCode: "CODE", memberCount: 3, role: "HOST", createdAt: "",
  });
  qc.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, {
    rooms: [
      { id: ROOM, title: "여행", destinations: [], startDate: null, endDate: null, role: "HOST", joinedAt: "" },
      { id: "other", title: "다른 여행", destinations: [], startDate: null, endDate: null, role: "HOST", joinedAt: "" },
    ],
    nextCursor: null,
    hasNext: false,
  });
  return qc;
}

describe("applyHostTransferToCache", () => {
  it("위임 직후 세 출처 모두 참여자로 바뀌어 방장 판정이 풀린다", () => {
    const qc = seeded();
    applyHostTransferToCache(qc, ROOM, 1, 2);

    const members = qc.getQueryData<RoomMemberListResponse>(roomMembersQueryKey(ROOM))!.members;
    expect(members.map((m) => [m.userId, m.role])).toEqual([[1, "MEMBER"], [2, "HOST"], [3, "MEMBER"]]);
    const detail = qc.getQueryData<RoomDetail>(roomDetailQueryKey(ROOM))!;
    expect(detail).toMatchObject({ role: "MEMBER", inviteCode: null });
    const rooms = qc.getQueryData<RoomListResponse>(ROOMS_QUERY_KEY)!.rooms;
    expect(rooms.map((r) => r.role)).toEqual(["MEMBER", "HOST"]);

    expect(resolveViewerIsHost({ listRole: rooms[0].role, detailRole: detail.role, memberRole: members[0].role })).toBe(false);
  });

  it("캐시가 없으면 아무것도 만들지 않는다", () => {
    const qc = new QueryClient();
    applyHostTransferToCache(qc, ROOM, 1, 2);
    expect(qc.getQueryData(roomMembersQueryKey(ROOM))).toBeUndefined();
    expect(qc.getQueryData(roomDetailQueryKey(ROOM))).toBeUndefined();
    expect(qc.getQueryData(ROOMS_QUERY_KEY)).toBeUndefined();
  });
});
