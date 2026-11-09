"use client";

import { expenseKeys } from "@/lib/expenses/expense-queries";

import type { QueryClient } from "@tanstack/react-query";

import {
  ROOMS_QUERY_KEY,
  roomDetailQueryKey,
  roomMembersQueryKey,
} from "@/lib/query-keys";
import { invalidateAfterChange } from "@/lib/query-client";
import { readSessionUserId } from "@/lib/session-user-cache";

import type { RoomMemberPayload } from "./member-events";

/**
 * 내가 이 방에서 나가거나 내보내진 이벤트인지 — 이미 접근을 잃은 방이라 다시 받으면 403을 받는다.
 * 방 캐시는 나가기(`useLeaveRoom`·다른 탭은 `onSelfLeftRoom`)와 강퇴(개인 큐) 처리가 지운다.
 * 누가 나갔는지 모르는 이벤트도 나일 수 있어 같이 건너뛴다.
 */
function removesViewer(queryClient: QueryClient, event: RoomMemberPayload): boolean {
  if (event.type !== "MEMBER_LEFT" && event.type !== "MEMBER_KICKED") return false;
  return event.detail == null || event.detail.userId === readSessionUserId(queryClient);
}

/**
 * members STOMP 한 건 — 바뀐 멤버 목록을 서버에서 다시 받게 한다. 이벤트 내용으로 캐시를 고치지 않는다:
 * 이벤트 전에 출발한 조회는 첫 조회라도 취소하고 새로 받는다(`invalidateAfterChange` — 패치는 그 응답에 덮였다).
 * 화면에 있는 목록만 바로 다시 받고 나머지는 다시 볼 때 받는다.
 * 채팅 발신자 이름은 `room-members`에서 찾으므로, 채팅은 새 멤버의 메시지를 이 목록을 다시 받을 때까지 그리지 않는다(`useChatMessages`).
 */
export function dispatchRoomMemberEvent(
  queryClient: QueryClient,
  subscribedRoomId: string,
  event: RoomMemberPayload,
): void {
  const rid = String(event.roomId ?? "").trim() || subscribedRoomId;
  if (!rid || removesViewer(queryClient, event)) return;

  void invalidateAfterChange(queryClient, { queryKey: roomMembersQueryKey(rid) });
  void invalidateAfterChange(queryClient, { queryKey: expenseKeys.members(rid) });

  if (event.type === "HOST_DELEGATED") {
    // 방장 판정은 방 목록·방 상세·멤버 세 출처 중 하나라도 HOST면 방장으로 본다(resolveViewerIsHost).
    // 하나라도 옛 역할이 남으면 이전 방장에게 "먼저 방장을 위임해 주세요"가 다시 뜬다
    void invalidateAfterChange(queryClient, { queryKey: ROOMS_QUERY_KEY });
    void invalidateAfterChange(queryClient, { queryKey: roomDetailQueryKey(rid) });
  }
}
