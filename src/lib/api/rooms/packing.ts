import { apiFetch } from "@/lib/api/client";
import { apiUrl, jsonBody, tryParseJson } from "@/lib/api/http";
import { assertPackingChecked, assertPackingId, assertPackingVersion, normalizePackingMemo, normalizePackingName } from "@/lib/packing/validation";
import type { PackingList, PackingPart, PackingItem, PackingPartWrite, PackingItemWrite, PackingPartDelete, PackingItemDelete } from "@/lib/packing/types";
export type * from "@/lib/packing/types";

export class PackingApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = "PackingApiError"; }
}
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function malformed(): never { throw new PackingApiError(502, "INVALID_PACKING_RESPONSE", "준비물 응답을 확인하지 못했어요. 다시 불러와 주세요."); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return malformed();
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) return malformed();
  return value;
}
function text(value: unknown): string { if (typeof value !== "string") return malformed(); return value; }
function timestamp(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || !Number.isFinite(Date.parse(result))) return malformed();
  return result;
}
function array<T>(value: unknown, parse: (entry: unknown) => T): T[] { if (!Array.isArray(value)) return malformed(); return value.map(parse); }
function item(value: unknown): PackingItem {
  const o = record(value), id = integer(o.id, 1);
  if (typeof o.checked !== "boolean") return malformed();
  let memo = null;
  if (o.memo !== null) {
    const m = record(o.memo);
    if (integer(m.id, 1) !== id || integer(m.itemId, 1) !== id) return malformed();
    memo = { id, itemId: id, content: text(m.content) };
  }
  return { id, partId: integer(o.partId, 1), name: text(o.name), checked: o.checked, position: integer(o.position), memo };
}
function part(value: unknown): PackingPart {
  const o = record(value), id = integer(o.id, 1), column = integer(o.column);
  if (column > 2) return malformed();
  const items = array(o.items, item);
  if (items.some(entry => entry.partId !== id)) return malformed();
  return { id, name: text(o.name), position: integer(o.position), column, items };
}
function list(value: unknown): PackingList {
  const o = record(value), roomId = text(o.roomId);
  if (!uuid.test(roomId)) return malformed();
  return { id: integer(o.id, 1), roomId, ownerUserId: integer(o.ownerUserId, 1), version: integer(o.version), initializedAt: timestamp(o.initializedAt), parts: array(o.parts, part) };
}
function partWrite(value: unknown): PackingPartWrite { const o = record(value); return { version: integer(o.version), part: part(o.part) }; }
function itemWrite(value: unknown): PackingItemWrite { const o = record(value); return { version: integer(o.version), item: item(o.item) }; }
function partDelete(value: unknown): PackingPartDelete { const o = record(value); return { version: integer(o.version), deletedPartId: integer(o.deletedPartId, 1) }; }
function itemDelete(value: unknown): PackingItemDelete {
  const o = record(value);
  let undo = null;
  if (o.undo !== null) { const u = record(o.undo); const token = text(u.token); if (!uuid.test(token)) return malformed(); undo = { token, expiresAt: timestamp(u.expiresAt) }; }
  return { version: integer(o.version), deletedItemId: integer(o.deletedItemId, 1), serverTime: timestamp(o.serverTime), undo };
}
async function request<T>(roomId: string, suffix: string, parse: (value: unknown) => T, init: RequestInit = {}): Promise<T> {
  if (!uuid.test(roomId)) throw new PackingApiError(400, "BAD_REQUEST", "여행방 주소를 확인해 주세요.");
  const response = await apiFetch(apiUrl(`/rooms/${roomId}/packing${suffix}`), { ...init, cache: "no-store" });
  const body = await tryParseJson(response);
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as Record<string, unknown> : {};
    throw new PackingApiError(response.status, typeof error.code === "string" ? error.code : "UNKNOWN", typeof error.message === "string" ? error.message : "준비물 요청에 실패했어요. 다시 시도해 주세요.");
  }
  return parse(body);
}
function guard(id: number, version: number) { assertPackingId(id); assertPackingVersion(version); }
function nameBody(version: number, name: string, kind: "part" | "item") { assertPackingVersion(version); return jsonBody({ expectedVersion: version, name: normalizePackingName(name, kind) }); }
export const packingApi = {
  get: (roomId: string, signal?: AbortSignal) => request(roomId, "", list, { signal }),
  initialize: (roomId: string) => request(roomId, "", list, { method: "POST", ...jsonBody({}) }),
  createPart: (roomId: string, version: number, name: string) => request(roomId, "/parts", partWrite, { method: "POST", ...nameBody(version, name, "part") }),
  renamePart: (roomId: string, id: number, version: number, name: string) => { guard(id, version); return request(roomId, `/parts/${id}`, partWrite, { method: "PATCH", ...nameBody(version, name, "part") }); },
  deletePart: (roomId: string, id: number, version: number, confirmed: boolean) => { guard(id, version); assertPackingChecked(confirmed); return request(roomId, `/parts/${id}?expectedVersion=${version}&confirmed=${confirmed}`, partDelete, { method: "DELETE" }); },
  createItem: (roomId: string, partId: number, version: number, name: string) => { guard(partId, version); return request(roomId, `/parts/${partId}/items`, itemWrite, { method: "POST", ...nameBody(version, name, "item") }); },
  renameItem: (roomId: string, id: number, version: number, name: string) => { guard(id, version); return request(roomId, `/items/${id}`, itemWrite, { method: "PATCH", ...nameBody(version, name, "item") }); },
  checkItem: (roomId: string, id: number, version: number, checked: boolean) => { guard(id, version); assertPackingChecked(checked); return request(roomId, `/items/${id}/checked`, itemWrite, { method: "PATCH", ...jsonBody({ expectedVersion: version, checked }) }); },
  deleteItem: (roomId: string, id: number, version: number, confirmed: boolean) => { guard(id, version); assertPackingChecked(confirmed); return request(roomId, `/items/${id}?expectedVersion=${version}&confirmed=${confirmed}`, itemDelete, { method: "DELETE" }); },
  restoreItem: (roomId: string, id: number, version: number, undoToken: string) => { guard(id, version); if (!uuid.test(undoToken)) throw new PackingApiError(400, "BAD_REQUEST", "실행 취소 정보를 확인해 주세요."); return request(roomId, `/items/${id}/restore`, itemWrite, { method: "POST", ...jsonBody({ expectedVersion: version, undoToken }) }); },
  saveMemo: (roomId: string, id: number, version: number, content: string) => { guard(id, version); return request(roomId, `/items/${id}/memo`, itemWrite, { method: "PUT", ...jsonBody({ expectedVersion: version, content: normalizePackingMemo(content) ?? "" }) }); },
  deleteMemo: (roomId: string, id: number, version: number) => { guard(id, version); return request(roomId, `/items/${id}/memo?expectedVersion=${version}`, itemWrite, { method: "DELETE" }); },
};
