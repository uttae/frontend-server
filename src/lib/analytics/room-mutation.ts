import type { QueryClient } from "@tanstack/react-query";
import type { RoomDetail, RoomListResponse, RoomMemberListResponse } from "@/lib/api/rooms/types";
import { roomDetailQueryKey, roomMembersQueryKey, ROOMS_QUERY_KEY, sessionUserQueryKey } from "@/lib/query-keys";
import { readSessionUserId } from "@/lib/session-user-cache";
import { useSessionStore } from "@/stores/session-store";
import { analyticsConsentStore } from "./consent-store";
import { toAnalyticsRoomRole } from "./context";
import { AnalyticsEvents, trackAnalyticsEvent } from "./track";

type RoomMutationEvent = typeof AnalyticsEvents.inviteCodeIssued | typeof AnalyticsEvents.roomInfoUpdated;

function roomRole(client: QueryClient, roomId: string) {
  const detail = client.getQueryData<RoomDetail>(roomDetailQueryKey(roomId));
  const summary = client.getQueryData<RoomListResponse>(ROOMS_QUERY_KEY)?.rooms.find(room => room.id === roomId);
  return toAnalyticsRoomRole(detail?.role ?? summary?.role);
}

/** Only these room writes use this scope; never inject the selected room into events. */
export async function trackRoomMutation<Result>(
  client: QueryClient,
  roomId: string,
  event: RoomMutationEvent,
  action: () => Promise<Result>,
  responseRole?: (result: Result) => string,
): Promise<Result> {
  const actor = readSessionUserId(client);
  const selectedRoom = useSessionStore.getState().currentRoomId;
  const role = roomRole(client, roomId);
  let active = actor !== undefined && Boolean(role) &&
    useSessionStore.getState().sessionReady && analyticsConsentStore.isGranted();
  const checkScope = () => {
    const session = useSessionStore.getState();
    const member = client.getQueryData<RoomMemberListResponse>(roomMembersQueryKey(roomId))
      ?.members.find(member => member.userId === actor);
    if (!session.sessionReady || session.currentRoomId !== selectedRoom ||
      readSessionUserId(client) !== actor || !analyticsConsentStore.isGranted() ||
      !roomRole(client, roomId) || (member && (member.status !== "ACTIVE" || !toAnalyticsRoomRole(member.role)))) {
      active = false;
    }
  };
  checkScope();
  const watchedKeys = [sessionUserQueryKey, roomDetailQueryKey(roomId), roomMembersQueryKey(roomId), ROOMS_QUERY_KEY]
    .map(key => JSON.stringify(key));
  const unsubscribeCache = client.getQueryCache().subscribe(change => {
    if (!watchedKeys.includes(JSON.stringify(change.query.queryKey))) return;
    if (change.type === "removed") active = false;
    checkScope();
  });
  const unsubscribeSession = useSessionStore.subscribe(checkScope);
  const unsubscribeConsent = analyticsConsentStore.subscribe(checkScope);
  try {
    const result = await action();
    checkScope();
    const actualRole = responseRole ? toAnalyticsRoomRole(responseRole(result)) : role;
    if (active && actualRole) {
      trackAnalyticsEvent(event, { room_id: roomId, role: actualRole });
    }
    return result;
  } finally {
    unsubscribeCache();
    unsubscribeSession();
    unsubscribeConsent();
  }
}
