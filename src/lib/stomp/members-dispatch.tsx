"use client";

import { expenseKeys } from "@/lib/expenses/expense-queries";

import type { QueryClient } from "@tanstack/react-query";

import type {
  RoomListResponse,
  RoomMember,
  RoomMemberListResponse,
} from "@/lib/api/rooms";
import { CHAT_UNKNOWN_SENDER_LABEL } from "@/lib/chat";
import { ROOMS_QUERY_KEY, roomMembersQueryKey } from "@/lib/query-keys";
import { readSessionUserId } from "@/lib/session-user-cache";

import type {
  MemberUserSnapshotDetail,
  RoomMemberPayload,
} from "./member-events";

function upsertMemberRow(
  members: RoomMember[],
  userId: number,
  patch: Partial<RoomMember> & Pick<RoomMember, "status">,
  fallback: Omit<RoomMember, "userId">,
): RoomMember[] {
  const idx = members.findIndex((m) => m.userId === userId);
  if (idx >= 0) {
    const next = [...members];
    const cur = next[idx]!;
    next[idx] = { ...cur, ...patch };
    return next;
  }
  return [...members, { userId, ...fallback, ...patch }];
}

function memberDisplayPatch(
  d: MemberUserSnapshotDetail,
): Partial<Pick<RoomMember, "nickname" | "profileImageUrl">> {
  const patch: Partial<Pick<RoomMember, "nickname" | "profileImageUrl">> = {};
  const nick = d.nickname?.trim();
  if (nick && nick.length > 0) patch.nickname = nick;
  if (d.profileImageUrl !== undefined) patch.profileImageUrl = d.profileImageUrl;
  return patch;
}

function patchRoomsRoleForHostDelegation(
  queryClient: QueryClient,
  roomId: string,
  previousHostUserId: number,
  newHostUserId: number,
): void {
  const me = readSessionUserId(queryClient);
  if (me == null) return;

  queryClient.setQueryData<RoomListResponse>(ROOMS_QUERY_KEY, (prev) => {
    if (!prev?.rooms?.length) return prev;
    return {
      ...prev,
      rooms: prev.rooms.map((r) => {
        if (r.id !== roomId) return r;
        if (me === previousHostUserId) return { ...r, role: "MEMBER" };
        if (me === newHostUserId) return { ...r, role: "HOST" };
        return r;
      }),
    };
  });
}

/**
 * members STOMP 한 건 — `metadata`만으로 `room-members`·방 목록(role) 캐시를 직접 갱신합니다.
 * 채팅 UI는 room-members 캐시의 userId와 메시지 senderId 매핑으로 발신자를 표시합니다.
 */
export function dispatchRoomMemberEvent(
  queryClient: QueryClient,
  subscribedRoomId: string,
  event: RoomMemberPayload,
): void {
  const rid = String(event.roomId ?? "").trim() || subscribedRoomId;
  if (!rid) return;
  void queryClient.invalidateQueries({ queryKey: expenseKeys.members(rid) });

  switch (event.type) {
    case "MEMBER_JOINED": {
      const d = event.detail;
      if (!d) return;

      queryClient.setQueryData<RoomMemberListResponse>(
        roomMembersQueryKey(rid),
        (prev) => {
          const members = prev?.members ?? [];
          const joinedAt =
            event.createdAt.trim().length > 0
              ? event.createdAt
              : new Date().toISOString();
          const display = memberDisplayPatch(d);
          const next = upsertMemberRow(
            members,
            d.userId,
            {
              ...display,
              status: "ACTIVE",
              isOnline: true,
            },
            {
              nickname: display.nickname ?? CHAT_UNKNOWN_SENDER_LABEL,
              profileImageUrl: display.profileImageUrl ?? null,
              role: "MEMBER",
              status: "ACTIVE",
              joinedAt,
              isOnline: true,
            },
          );
          return prev ? { ...prev, members: next } : { members: next };
        },
      );
      break;
    }

    case "MEMBER_LEFT":
    case "MEMBER_KICKED": {
      const d = event.detail;
      if (!d) return;

      queryClient.setQueryData<RoomMemberListResponse>(
        roomMembersQueryKey(rid),
        (prev) => {
          const members = prev?.members ?? [];
          const idx = members.findIndex((m) => m.userId === d.userId);
          const display = memberDisplayPatch(d);

          if (idx >= 0) {
            const next = [...members];
            const cur = next[idx]!;
            next[idx] = {
              ...cur,
              ...display,
              status: "LEFT",
              isOnline: false,
            };
            return prev ? { ...prev, members: next } : { members: next };
          }

          const leftMember: RoomMember = {
            userId: d.userId,
            nickname: display.nickname ?? CHAT_UNKNOWN_SENDER_LABEL,
            profileImageUrl: display.profileImageUrl ?? null,
            role: "MEMBER",
            status: "LEFT",
            joinedAt:
              event.createdAt.trim().length > 0
                ? event.createdAt
                : new Date().toISOString(),
            isOnline: false,
          };
          return {
            members: [...members, leftMember],
          };
        },
      );
      break;
    }

    case "HOST_DELEGATED": {
      const d = event.detail;
      if (!d) return;

      queryClient.setQueryData<RoomMemberListResponse>(
        roomMembersQueryKey(rid),
        (prev) => {
          if (!prev?.members?.length) return prev;
          const members = prev.members.map((m) => {
            if (m.userId === d.previousHostUserId) {
              return { ...m, role: "MEMBER" as const };
            }
            if (m.userId === d.newHostUserId) {
              return { ...m, role: "HOST" as const };
            }
            return m;
          });
          return { ...prev, members };
        },
      );

      patchRoomsRoleForHostDelegation(
        queryClient,
        rid,
        d.previousHostUserId,
        d.newHostUserId,
      );
      break;
    }

    default:
      break;
  }
}
