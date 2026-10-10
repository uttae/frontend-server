import { describe, expect, it } from "vitest";
import { isAnalyticsRoomPath, resolveAnalyticsRoomId } from "./room-context";

const session = { currentRoomId: "room-a", sessionReady: true, userId: 42 };
describe("room route boundaries", () => {
  it.each(["/plan/room-a///", "/search/?q=value", "/bookmark/folder#section", "/cost"])(
    "accepts the supported route %s", (pathname) => expect(isAnalyticsRoomPath(pathname)).toBe(true),
  );
  it.each(["//search", "search", "/plan//room-a", "/plan/room-a/extra", "/packing", "/search/extra", "/", `/${"/".repeat(10000)}unknown`])(
    "rejects malformed or unsupported route %#", (pathname) => expect(isAnalyticsRoomPath(pathname)).toBe(false),
  );
});
describe("optional analytics room context", () => {
  it.each(["/plan", "/plan/room-a", "/search", "/cost", "/bookmark/folder-b", "/settings", "/member-settings", "/room-settings"])(
    "uses confirmed selected room for %s", (pathname) => {
      expect(resolveAnalyticsRoomId({ ...session, pathname })).toBe("room-a");
    },
  );
  it.each(["/", "/home", "/home/new", "/login", "/join/code", "/privacy-settings", "/search/unknown", "/plan/room-b", "/plan/%E0%A4%A", "/packing/not-a-room"])(
    "does not infer selected room for %s", (pathname) => {
      expect(resolveAnalyticsRoomId({ ...session, pathname })).toBeUndefined();
    },
  );
  it("requires both session reconciliation and known identity", () => {
    expect(resolveAnalyticsRoomId({ ...session, pathname: "/search", sessionReady: false })).toBeUndefined();
    expect(resolveAnalyticsRoomId({ ...session, pathname: "/search", userId: undefined })).toBeUndefined();
    expect(resolveAnalyticsRoomId({ ...session, pathname: "/search", currentRoomId: null })).toBeUndefined();
  });
  it("requires the packing URL room to match the selected room", () => {
    const roomId = "11111111-1111-1111-1111-111111111111";
    expect(resolveAnalyticsRoomId({ ...session, pathname: `/packing/${roomId}` })).toBeUndefined();
    expect(resolveAnalyticsRoomId({ ...session, pathname: `/packing/${roomId}`, currentRoomId: roomId })).toBe(roomId);
  });
});
