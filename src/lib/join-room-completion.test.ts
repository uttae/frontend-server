import { describe, expect, it, vi } from "vitest";

import { AnalyticsEvents } from "@/lib/analytics/track";
import type {
  JoinRoomResponse,
  RoomDetail,
} from "@/lib/api/rooms/types";
import type { AnalyticsEventParamsMap } from "@/lib/analytics/track";
import { completeWaitingJoinApproval } from "@/lib/join-room-workflow";

type JoinPlanParams = AnalyticsEventParamsMap[typeof AnalyticsEvents.joinPlan];

type WaitingApprovalDependencies = {
  cacheRoomDetail: (roomId: string, detail: RoomDetail) => void;
  getRoomDetail: (roomId: string) => Promise<RoomDetail>;
  navigateToPlan: (path: string) => void;
  setCurrentRoomId: (roomId: string) => void;
  trackAnalyticsEvent: (
    eventName: typeof AnalyticsEvents.joinPlan,
    params: JoinPlanParams,
  ) => void;
};

const approvedResponse: JoinRoomResponse = {
  status: "APPROVED",
  id: "room-123",
  roomTitle: "제주 여행",
  role: "MEMBER",
};

const roomDetail: RoomDetail = {
  id: "room-123",
  title: "제주 여행",
  destinations: ["제주"],
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  inviteCode: "private-invite-code",
  memberCount: 4,
  role: "MEMBER",
  createdAt: "2026-07-21T00:00:00.000Z",
};

function createDependencies(
  overrides: Partial<WaitingApprovalDependencies> = {},
): WaitingApprovalDependencies {
  return {
    cacheRoomDetail: vi.fn(),
    getRoomDetail: vi.fn().mockResolvedValue(roomDetail),
    navigateToPlan: vi.fn(),
    setCurrentRoomId: vi.fn(),
    trackAnalyticsEvent: vi.fn(),
    ...overrides,
  };
}

describe("completeWaitingJoinApproval", () => {
  it("sends join_group exactly once with approved metadata before navigating", async () => {
    const steps: string[] = [];
    const dependencies = createDependencies({
      navigateToPlan: vi.fn(() => steps.push("navigate")),
      trackAnalyticsEvent: vi.fn((eventName, params) => {
        steps.push(`track:${eventName}:${params.member_count_bucket}`);
      }),
    });

    const completed = await completeWaitingJoinApproval(
      approvedResponse,
      dependencies,
    );

    expect(completed).toBe(true);
    expect(dependencies.trackAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(dependencies.trackAnalyticsEvent).toHaveBeenCalledWith(
      AnalyticsEvents.joinPlan,
      { room_id: "room-123", member_count_bucket: "3_4", role: "member" },
    );
    expect(dependencies.cacheRoomDetail).toHaveBeenCalledWith(
      approvedResponse.id,
      roomDetail,
    );
    expect(steps).toEqual(["track:join_group:3_4", "navigate"]);
  });

  it("sends join_group without a member bucket when metadata lookup fails", async () => {
    const dependencies = createDependencies({
      getRoomDetail: vi.fn().mockRejectedValue(new Error("network failed")),
    });

    const completed = await completeWaitingJoinApproval(
      approvedResponse,
      dependencies,
    );

    expect(completed).toBe(true);
    expect(dependencies.trackAnalyticsEvent).toHaveBeenCalledWith(
      AnalyticsEvents.joinPlan,
      { room_id: "room-123", member_count_bucket: undefined, role: "member" },
    );
    expect(dependencies.navigateToPlan).toHaveBeenCalledWith("/plan/room-123");
  });

  it.each(["JOINED", "ACCEPTED"])(
    "treats raw %s as an approved completion",
    async (status) => {
      const steps: string[] = [];
      const dependencies = createDependencies({
        navigateToPlan: vi.fn(() => steps.push("navigate")),
        trackAnalyticsEvent: vi.fn((eventName) => {
          steps.push(`track:${eventName}`);
        }),
      });

      const completed = await completeWaitingJoinApproval(
        { ...approvedResponse, status },
        dependencies,
      );

      expect(completed).toBe(true);
      expect(dependencies.trackAnalyticsEvent).toHaveBeenCalledTimes(1);
      expect(dependencies.trackAnalyticsEvent).toHaveBeenCalledWith(
        AnalyticsEvents.joinPlan,
        { room_id: "room-123", member_count_bucket: "3_4", role: "member" },
      );
      expect(steps).toEqual(["track:join_group", "navigate"]);
    },
  );

  it.each(["PENDING", "REJECTED"])(
    "does not send join_group for %s results",
    async (status) => {
      const dependencies = createDependencies();

      const completed = await completeWaitingJoinApproval(
        { ...approvedResponse, status },
        dependencies,
      );

      expect(completed).toBe(false);
      expect(dependencies.getRoomDetail).not.toHaveBeenCalled();
      expect(dependencies.trackAnalyticsEvent).not.toHaveBeenCalled();
      expect(dependencies.navigateToPlan).not.toHaveBeenCalled();
    },
  );
});
