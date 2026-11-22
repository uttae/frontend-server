export type ForcedRoomExitReason = "kicked" | "room_deleted";

export type UserRoomQueueMessage =
  | {
      kind: "forced_exit";
      reason: ForcedRoomExitReason;
      roomId: string;
      message?: string;
    }
  | {
      kind: "join_request";
      roomId: string;
      requesterId: number;
      nickname: string;
      profileImageUrl: string | null;
    };

function parseOptionalServerMessage(raw: Record<string, unknown>): string | undefined {
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  return message || undefined;
}

export function parseUserRoomQueueMessage(body: string): UserRoomQueueMessage | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const actionType = typeof raw?.actionType === "string" ? raw.actionType : "";

    const roomIdRaw = raw.roomId;
    const roomId = typeof roomIdRaw === "string" || typeof roomIdRaw === "number" ? String(roomIdRaw).trim() : "";
    if (!roomId) return null;

    const serverMessage = parseOptionalServerMessage(raw);

    if (actionType === "KICKED") {
      return {
        kind: "forced_exit",
        reason: "kicked",
        roomId,
        ...(serverMessage ? { message: serverMessage } : {}),
      };
    }
    if (actionType === "ROOM_DELETED") {
      return {
        kind: "forced_exit",
        reason: "room_deleted",
        roomId,
        ...(serverMessage ? { message: serverMessage } : {}),
      };
    }

    return parseJoinRequest(raw, roomId);
  } catch {
    return null;
  }
}

function parseJoinRequest(raw: Record<string, unknown>, roomId: string): UserRoomQueueMessage | null {
  const requesterIdRaw = raw.requesterId;
  const requesterId =
    typeof requesterIdRaw === "number" || typeof requesterIdRaw === "string" ? Number(requesterIdRaw) : NaN;
  if (!Number.isFinite(requesterId)) return null;

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
  const profileImageUrlRaw = raw.profileImageUrl;
  const profileImageUrl =
    typeof profileImageUrlRaw === "string" && profileImageUrlRaw.trim() ? profileImageUrlRaw.trim() : null;

  return {
    kind: "join_request",
    roomId,
    requesterId,
    nickname,
    profileImageUrl,
  };
}
