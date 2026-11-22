import { describe, expect, it } from "vitest";
import { parseRoomPresenceMessage } from "./events";
import { parseRoomMemberMessage } from "./member-events";
import { parseUserRoomQueueMessage } from "./user-room-queue";

describe("external room event identifiers", () => {
  it.each(["room-1", 123])("preserves string and numeric identifiers: %s", (roomId) => {
    expect(parseRoomPresenceMessage(JSON.stringify({ type: "USER_CONNECTED", roomId, userId: 1 }))?.roomId).toBe(
      String(roomId),
    );
    expect(parseRoomMemberMessage(JSON.stringify({ type: "MEMBER_LEFT", roomId, id: 456 }))?.id).toBe("456");
    expect(parseUserRoomQueueMessage(JSON.stringify({ actionType: "KICKED", roomId }))).toMatchObject({
      kind: "forced_exit",
      roomId: String(roomId),
      reason: "kicked",
    });
  });

  it.each([{}, ["room-1"], true, null])("does not coerce malformed identifiers: %j", (roomId) => {
    expect(parseRoomPresenceMessage(JSON.stringify({ type: "USER_CONNECTED", roomId, userId: 1 }))?.roomId).toBe("");
    expect(parseRoomMemberMessage(JSON.stringify({ type: "MEMBER_LEFT", roomId, id: roomId }))).toMatchObject({
      roomId: "",
      id: "",
    });
    expect(parseUserRoomQueueMessage(JSON.stringify({ actionType: "KICKED", roomId }))).toBeNull();
  });

  it("preserves join-request coercion and whitespace normalization", () => {
    expect(
      parseUserRoomQueueMessage(
        JSON.stringify({ roomId: " room ", requesterId: "12", nickname: " name ", profileImageUrl: " image " }),
      ),
    ).toEqual({
      kind: "join_request",
      roomId: "room",
      requesterId: 12,
      nickname: "name",
      profileImageUrl: "image",
    });
    expect(parseUserRoomQueueMessage(JSON.stringify({ roomId: "room", requesterId: {} }))).toBeNull();
  });
});
