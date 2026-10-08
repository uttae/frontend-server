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
  visible: result.visible.map(({ member, isOnline }) => `${member.userId}${isOnline ? "on" : "off"}`),
  restCount: result.restCount,
});

describe("selectHeaderMemberPreview", () => {
  it("혼자면 원 1개만 보여준다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true)], 1))).toEqual({ visible: ["1on"], restCount: 0 });
  });

  it("온라인 다음에 오프라인을 채워 최대 2명까지 보여준다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, false)], 1))).toEqual({ visible: ["1on", "2off"], restCount: 0 });
    expect(ids(selectHeaderMemberPreview([member(1, true), member(3, false), member(2, true)], 1))).toEqual({ visible: ["1on", "2on"], restCount: 1 });
    expect(ids(selectHeaderMemberPreview([member(1, false), member(2, false), member(3, false)], 1))).toEqual({ visible: ["1on", "2off"], restCount: 1 });
  });

  it("2명을 넘으면 나머지는 +N으로 묶는다", () => {
    expect(ids(selectHeaderMemberPreview([member(1, true), member(2, true), member(3, true), member(4, true), member(5, false)], 1))).toEqual({ visible: ["1on", "2on"], restCount: 3 });
  });

  it("본인은 접속 상태와 관계없이 온라인으로 맨 앞에 두고, 나간 구성원은 세지 않는다", () => {
    expect(ids(selectHeaderMemberPreview([member(2, true), member(1, false), member(3, false, "LEFT")], 1))).toEqual({ visible: ["1on", "2on"], restCount: 0 });
  });
});
