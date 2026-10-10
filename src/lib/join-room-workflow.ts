import type { JoinRoomResponse, RoomDetail } from "@/lib/api/rooms/types";
import {
  bucketMemberCount,
  toAnalyticsRoomRole,
} from "@/lib/analytics/context";
import { AnalyticsEvents } from "@/lib/analytics/track";
import type { AnalyticsEventParamsMap } from "@/lib/analytics/track";

const APPROVED_ALIASES = new Set(["APPROVED", "JOINED", "ACCEPTED"]);
const REJECTED_ALIASES = new Set(["REJECTED", "REJECT", "DENIED", "DECLINED"]);

export function isJoinApprovedStatus(normalizedUpper: string): boolean {
  if (!normalizedUpper) return false;
  return APPROVED_ALIASES.has(normalizedUpper.toUpperCase());
}

/** 대기 페이지에서 결과 배지용 (PENDING / APPROVED / REJECTED) */
export type JoinWaitingUiStatus = "PENDING" | "APPROVED" | "REJECTED";

export function joinStatusForWaitingUi(
  payload: JoinRoomResponse,
): JoinWaitingUiStatus {
  const s =
    typeof payload.status === "string" ? payload.status.trim() : "";
  const upper = s.toUpperCase();
  if (isJoinApprovedStatus(upper)) return "APPROVED";
  if (REJECTED_ALIASES.has(upper)) return "REJECTED";
  if (upper) return "PENDING";
  return "PENDING";
}

export function planPathForRoom(roomId: string): string {
  const id = roomId.trim();
  return id.length > 0 ? `/plan/${encodeURIComponent(id)}` : "/plan";
}

type JoinPlanAnalyticsParams = AnalyticsEventParamsMap[typeof AnalyticsEvents.joinPlan];

export function buildJoinPlanAnalyticsParams(
  roomId: string,
  role: string,
  memberCount?: number,
): JoinPlanAnalyticsParams {
  return {
    room_id: roomId.trim(),
    member_count_bucket:
      memberCount === undefined ? undefined : bucketMemberCount(memberCount),
    role: toAnalyticsRoomRole(role),
  };
}

type WaitingApprovalDependencies = {
  cacheRoomDetail: (roomId: string, detail: RoomDetail) => void;
  getRoomDetail: (roomId: string) => Promise<RoomDetail>;
  navigateToPlan: (path: string) => void;
  setCurrentRoomId: (roomId: string) => void;
  trackAnalyticsEvent: (
    eventName: typeof AnalyticsEvents.joinPlan,
    params: JoinPlanAnalyticsParams,
  ) => void;
};

export async function completeWaitingJoinApproval(
  response: JoinRoomResponse,
  dependencies: WaitingApprovalDependencies,
): Promise<boolean> {
  if (joinStatusForWaitingUi(response) !== "APPROVED") return false;

  dependencies.setCurrentRoomId(response.id);

  let memberCount: number | undefined;
  try {
    const detail = await dependencies.getRoomDetail(response.id);
    memberCount = detail.memberCount;
    dependencies.cacheRoomDetail(response.id, detail);
  } catch {
    // 메타 조회 실패해도 입장은 진행
  }

  dependencies.trackAnalyticsEvent(
    AnalyticsEvents.joinPlan,
    buildJoinPlanAnalyticsParams(response.id, response.role, memberCount),
  );
  dependencies.navigateToPlan(planPathForRoom(response.id));
  return true;
}
