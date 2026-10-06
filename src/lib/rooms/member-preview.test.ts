import { describe, expect, it } from "vitest";

import type { RoomMember } from "@/lib/api/rooms";

import { selectHeaderMemberPreview } from "./member-preview";

function member(userId: number, isOnline: boolean, status: RoomMember["status"] = "ACTIVE"): RoomMember {
  return {
    userId,
    nickname: `멤버${userId}`,
    profileImageUrl: null,
    role: userId === 1 ? "HOST" : "MEMBER",
    status,
    joinedAt: "2026-10-01T00:00:00Z",
    isOnline,
  };
}

const ids = (result: ReturnType<typeof selectHeaderMemberPreview>) => ({
  visible: result.visible.map((m) => m.userId),
  restCount: result.restCount,
});

describe("selectHeaderMemberPreview", () => {
  it("혼자면 원 1개만 보여준다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true)], 1))).toEqual({ visible: [1], restCount: 0 });
  });

  it("오프라인 구성원은 +N으로 묶는다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, false)], 1))).toEqual({ visible: [1], restCount: 1 });
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, true), member(3, false)], 1))).toEqual({ visible: [1, 2], restCount: 1 });
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, true), member(3, false), member(4, false)], 1))).toEqual({ visible: [1, 2], restCount: 2 });
  });

  it("온라인은 최대 3명까지 보여주고 나머지는 +N에 더한다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, true), member(3, true), member(4, false)], 1))).toEqual({ visible: [1, 2, 3], restCount: 1 });
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, true), member(3, true), member(4, true), member(5, false)], 1))).toEqual({ visible: [1, 2, 3], restCount: 2 });
  });

  it("본인은 접속 상태와 관계없이 맨 앞에 두고, 나간 구성원은 세지 않는다", () => {
    expect(ids(selectHeaderMemberPreview([member(2, true), member(1, false), member(3, false, "LEFT")], 1))).toEqual({ visible: [1, 2], restCount: 0 });
  });
});
