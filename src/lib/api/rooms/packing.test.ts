import { beforeEach, expect, it, vi } from "vitest";
const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch: fetcher }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { packingApi } from "./packing";
const room = "12345678-1234-1234-1234-123456789abc";
const item = { id: 3, partId: 2, name: "여권", checked: false, position: 0, memo: null };
const part = { id: 2, name: "서류", column: 0, position: 0, items: [item] };
const list = { id: 1, roomId: room, ownerUserId: 4, version: 0, initializedAt: "2026-09-20T12:00:00Z", parts: [part] };
beforeEach(() => fetcher.mockReset());
it("GET never seeds; initialization uses exactly empty object and preserves empty list", async () => {
  const signal = new AbortController().signal;
  fetcher.mockResolvedValueOnce(Response.json(list));
  expect(await packingApi.get(room, signal)).toEqual(list);
  expect(fetcher.mock.lastCall).toEqual([`http://fixture/rooms/${room}/packing`, expect.objectContaining({ signal, cache: "no-store" })]);
  fetcher.mockResolvedValueOnce(Response.json({ ...list, parts: [] }, { status: 201 }));
  expect((await packingApi.initialize(room)).parts).toEqual([]);
  expect(fetcher.mock.lastCall?.[1]).toMatchObject({ method: "POST", body: "{}" });
});
it("uses every exact write endpoint, body, query and result", async () => {
  const cases = [
    [() => packingApi.createPart(room, 0, " 새 파트 "), "/parts", "POST", { expectedVersion: 0, name: "새 파트" }, { version: 1, part }],
    [() => packingApi.renamePart(room, 2, 0, "서류"), "/parts/2", "PATCH", { expectedVersion: 0, name: "서류" }, { version: 1, part }],
    [() => packingApi.deletePart(room, 2, 0, true), "/parts/2?expectedVersion=0&confirmed=true", "DELETE", undefined, { version: 1, deletedPartId: 2 }],
    [() => packingApi.createItem(room, 2, 0, "여권"), "/parts/2/items", "POST", { expectedVersion: 0, name: "여권" }, { version: 1, item }],
    [() => packingApi.renameItem(room, 3, 0, "여권"), "/items/3", "PATCH", { expectedVersion: 0, name: "여권" }, { version: 1, item }],
    [() => packingApi.checkItem(room, 3, 0, true), "/items/3/checked", "PATCH", { expectedVersion: 0, checked: true }, { version: 1, item: { ...item, checked: true } }],
    [() => packingApi.deleteItem(room, 3, 0, false), "/items/3?expectedVersion=0&confirmed=false", "DELETE", undefined, { version: 1, deletedItemId: 3, serverTime: list.initializedAt, undo: { token: room, expiresAt: "2026-09-20T12:00:10Z" } }],
    [() => packingApi.restoreItem(room, 3, 0, room), "/items/3/restore", "POST", { expectedVersion: 0, undoToken: room }, { version: 1, item }],
    [() => packingApi.saveMemo(room, 3, 0, " \r\n "), "/items/3/memo", "PUT", { expectedVersion: 0, content: "" }, { version: 1, item }],
    [() => packingApi.deleteMemo(room, 3, 0), "/items/3/memo?expectedVersion=0", "DELETE", undefined, { version: 1, item }],
  ] as const;
  for (const [call, suffix, method, body, result] of cases) {
    fetcher.mockResolvedValueOnce(Response.json(result));
    expect(await call()).toEqual(result);
    expect(fetcher.mock.lastCall?.[0]).toBe(`http://fixture/rooms/${room}/packing${suffix}`);
    expect(fetcher.mock.lastCall?.[1].method).toBe(method);
    expect(fetcher.mock.lastCall?.[1].body ? JSON.parse(fetcher.mock.lastCall[1].body) : undefined).toEqual(body);
  }
});
it.each([[400,"BAD_REQUEST"],[401,"UNAUTHORIZED"],[403,"NOT_ROOM_MEMBER"],[404,"ROOM_NOT_FOUND"],[404,"PACKING_LIST_NOT_INITIALIZED"],[404,"PACKING_PART_NOT_FOUND"],[404,"PACKING_ITEM_NOT_FOUND"],[404,"PACKING_UNDO_NOT_FOUND"],[409,"PACKING_CONFLICT"],[409,"PACKING_CONFIRMATION_REQUIRED"],[409,"PACKING_UNDO_USED"],[409,"PACKING_RESTORE_CONFLICT"],[409,"PACKING_CAPACITY_EXCEEDED"],[410,"PACKING_UNDO_EXPIRED"],[429,"TOO_MANY_REQUESTS"],[500,"ERROR"]])("preserves error %s/%s with no retries or initialization", async (status, code) => {
  fetcher.mockResolvedValueOnce(Response.json({ code, message: "서버 메시지" }, { status: status as number }));
  await expect(packingApi.get(room)).rejects.toMatchObject({ status, code, message: "서버 메시지" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("preserves network errors and abort", async () => {
  const error = new TypeError("network"); fetcher.mockRejectedValueOnce(error);
  await expect(packingApi.get(room)).rejects.toBe(error);
});
it.each([
  { ...list, version: Number.MAX_SAFE_INTEGER + 1 },
  { ...list, ownerUserId: "4" },
  { ...list, initializedAt: "2026-09-20" },
  { ...list, parts: [{ ...part, items: [{ ...item, memo: undefined }] }] },
  { ...list, parts: [{ ...part, items: [{ ...item, checked: "false" }] }] },
  { ...list, parts: [{ ...part, items: [{ ...item, memo: { id: 4, itemId: 3, content: "memo" } }] }] },
])("rejects malformed DTO instead of fabricating defaults", async payload => {
  fetcher.mockResolvedValueOnce(Response.json(payload));
  await expect(packingApi.get(room)).rejects.toMatchObject({ code: "INVALID_PACKING_RESPONSE" });
});
it("validates unsafe and temporary IDs/versions/inputs before transport", async () => {
  expect(() => packingApi.renameItem(room, -1, 0, "test")).toThrow();
  expect(() => packingApi.createPart(room, -1, "test")).toThrow();
  expect(() => packingApi.createPart(room, 0, "a".repeat(51))).toThrow();
  expect(() => packingApi.checkItem(room, 3, 0, "true" as unknown as boolean)).toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("preserves server column/position ordering, repeated names, safe IDs and nullable memo", async () => {
  const payload = { ...list, version: Number.MAX_SAFE_INTEGER, parts: [
    { ...part, id: Number.MAX_SAFE_INTEGER, column: 2, position: 8, items: [] },
    { ...part, items: [{ ...item, memo: { id: 3, itemId: 3, content: "https://example.com\n<script>plain text</script>" } }, { ...item, id: 5, position: 3 }] },
  ] };
  fetcher.mockResolvedValueOnce(Response.json(payload));
  expect(await packingApi.get(room)).toEqual(payload);
});
it("confirmed memo deletion has null undo and saves normalized plain memo content", async () => {
  const result = { version: 1, deletedItemId: 3, serverTime: list.initializedAt, undo: null };
  fetcher.mockResolvedValueOnce(Response.json(result));
  expect(await packingApi.deleteItem(room, 3, 0, true)).toEqual(result);
  fetcher.mockResolvedValueOnce(Response.json({ version: 1, item: { ...item, memo: { id: 3, itemId: 3, content: "a\nb\nc" } } }));
  await packingApi.saveMemo(room, 3, 0, "　a\r\nb\rc　");
  expect(JSON.parse(fetcher.mock.lastCall?.[1].body)).toEqual({ expectedVersion: 0, content: "a\nb\nc" });
});
it("keeps status of malformed error responses and rejects missing successful bodies", async () => {
  fetcher.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  await expect(packingApi.get(room)).rejects.toMatchObject({ status: 503, code: "UNKNOWN" });
  fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(packingApi.get(room)).rejects.toMatchObject({ status: 502, code: "INVALID_PACKING_RESPONSE" });
});
