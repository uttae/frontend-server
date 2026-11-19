import { pickProfileImageUrl } from "@/lib/api/profileImage";

export type RoomMemberBroadcastType =
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_KICKED"
  | "HOST_DELEGATED";

type RoomMemberPayloadBase = {
  content?: string;
  createdAt: string;
  id: string;
  roomId: string;
};

export type MemberUserSnapshotDetail = {
  userId: number;
  nickname?: string;
  profileImageUrl?: string | null;
};

export type HostDelegatedDetail = {
  previousHostUserId: number;
  newHostUserId: number;
  previousHostNickname?: string;
  newHostNickname?: string;
};

export type RoomMemberPayload =
  | (RoomMemberPayloadBase & {
      type: "MEMBER_JOINED";
      detail: MemberUserSnapshotDetail | null;
    })
  | (RoomMemberPayloadBase & {
      type: "MEMBER_LEFT";
      detail: MemberUserSnapshotDetail | null;
    })
  | (RoomMemberPayloadBase & {
      type: "MEMBER_KICKED";
      detail: MemberUserSnapshotDetail | null;
    })
  | (RoomMemberPayloadBase & {
      type: "HOST_DELEGATED";
      detail: HostDelegatedDetail | null;
    });

function parseMetadataRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function parseFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseMemberUserSnapshot(
  meta: Record<string, unknown>,
): MemberUserSnapshotDetail | null {
  const userId = parseFiniteNumber(meta.userId);
  if (userId == null) return null;

  const detail: MemberUserSnapshotDetail = { userId };

  const nicknameRaw = meta.nickname;
  const nicknameTrim =
    typeof nicknameRaw === "string" ? nicknameRaw.trim() : "";
  if (nicknameTrim.length > 0) detail.nickname = nicknameTrim;

  if ("profileImageUrl" in meta || "profile_image_url" in meta) {
    detail.profileImageUrl = pickProfileImageUrl(meta);
  }

  return detail;
}

function parseHostDelegated(
  meta: Record<string, unknown>,
): HostDelegatedDetail | null {
  const previousHostUserId = parseFiniteNumber(meta.previousHostUserId);
  const newHostUserId = parseFiniteNumber(meta.newHostUserId);
  if (previousHostUserId == null || newHostUserId == null) return null;

  const detail: HostDelegatedDetail = {
    previousHostUserId,
    newHostUserId,
  };

  const prevNickRaw = meta.previousHostNickname;
  const newNickRaw = meta.newHostNickname;
  const previousHostNickname =
    typeof prevNickRaw === "string" ? prevNickRaw.trim() : "";
  const newHostNickname =
    typeof newNickRaw === "string" ? newNickRaw.trim() : "";

  if (previousHostNickname.length > 0) {
    detail.previousHostNickname = previousHostNickname;
  }
  if (newHostNickname.length > 0) {
    detail.newHostNickname = newHostNickname;
  }

  return detail;
}

export function parseRoomMemberMessage(body: string): RoomMemberPayload | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const type = raw?.type;
    if (
      type !== "MEMBER_JOINED" &&
      type !== "MEMBER_LEFT" &&
      type !== "MEMBER_KICKED" &&
      type !== "HOST_DELEGATED"
    ) {
      return null;
    }

    const roomIdRaw = raw.roomId;
    const roomId =
      typeof roomIdRaw === "string"
        ? roomIdRaw
        : roomIdRaw != null
          ? String(roomIdRaw)
          : "";

    const content =
      typeof raw.content === "string" ? raw.content : undefined;
    const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
    const id =
      typeof raw.id === "string"
        ? raw.id
        : raw.id != null
          ? String(raw.id)
          : "";

    const base: RoomMemberPayloadBase = {
      roomId,
      createdAt,
      id,
      ...(content !== undefined ? { content } : {}),
    };

    const meta = parseMetadataRecord(raw.metadata);

    switch (type) {
      case "MEMBER_JOINED":
        return {
          ...base,
          type,
          detail: parseMemberUserSnapshot(meta),
        };
      case "MEMBER_LEFT":
      case "MEMBER_KICKED":
        return {
          ...base,
          type,
          detail: parseMemberUserSnapshot(meta),
        };
      case "HOST_DELEGATED":
        return {
          ...base,
          type,
          detail: parseHostDelegated(meta),
        };
      default:
        return null;
    }
  } catch {
    return null;
  }
}
