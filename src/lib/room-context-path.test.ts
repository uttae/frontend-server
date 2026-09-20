import { expect, it } from "vitest";
import { parseRoomContextPath } from "./room-context-path";
import { resolveRoomIdFromPathname } from "./session-room-storage";
import { roomIdFromPlanPathname } from "./plan-room-path";
const id = "12345678-1234-1234-1234-123456789abc";
it("resolves packing synchronously ahead of stale store room", () => {
  expect(parseRoomContextPath(`/packing/${id}`)).toEqual({ roomId: id, invalidPackingPath: false });
  expect(resolveRoomIdFromPathname("old", `/packing/${id}`)).toBe(id);
});
it.each(["/packing", "/packing/", "/packing/not-a-uuid", `/packing/${id}/extra`, "/packing/%", `/packing//${id}`])("suppresses fallback for %s", path => {
  expect(parseRoomContextPath(path).invalidPackingPath).toBe(true);
  expect(resolveRoomIdFromPathname("old", path)).toBeNull();
});
it.each(["/plan/a", "/plan/%20a%20", "/plan//a/", "/plan", "/plan/a/b", "/search"])("preserves existing plan resolution for %s", path => {
  expect(parseRoomContextPath(path).roomId).toBe(roomIdFromPlanPathname(path));
  expect(resolveRoomIdFromPathname("old", path)).toBe(roomIdFromPlanPathname(path) ?? "old");
});
it("canonicalizes packing UUID case without changing plan identifiers", () => {
  const upper = id.toUpperCase();
  expect(parseRoomContextPath(`/packing/${upper}`).roomId).toBe(id);
  expect(resolveRoomIdFromPathname("old", `/packing/${upper}`)).toBe(id);
  expect(parseRoomContextPath(`/plan/${upper}`).roomId).toBe(upper);
});
