import { pickProfileImageUrl } from "@/lib/api/profileImage";

export type RoomPresenceEventType = "USER_CONNECTED" | "USER_DISCONNECTED";

export type RoomPresenceChangedEvent = {
  nickname: string | null;
  profileImageUrl: string | null;
  roomId: string;
  type: RoomPresenceEventType;
  userId: number;
};

export function parseRoomPresenceMessage(body: string): RoomPresenceChangedEvent | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const type = raw?.type;
    if (type !== "USER_CONNECTED" && type !== "USER_DISCONNECTED") {
      return null;
    }

    const roomIdRaw = raw.roomId;
    const roomId = typeof roomIdRaw === "string" || typeof roomIdRaw === "number" ? String(roomIdRaw) : "";

    const userIdRaw = raw.userId;
    const uid = typeof userIdRaw === "number" && Number.isFinite(userIdRaw) ? userIdRaw : Number(userIdRaw);
    const userId = Number.isFinite(uid) ? uid : 0;

    const nickname = typeof raw.nickname === "string" ? raw.nickname : null;

    const profileUrl = pickProfileImageUrl(raw);

    return {
      type,
      roomId,
      userId,
      nickname,
      profileImageUrl: profileUrl,
    };
  } catch {
    return null;
  }
}
