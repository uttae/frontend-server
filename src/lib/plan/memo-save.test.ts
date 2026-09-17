import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query-client";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { advanceScheduleLifetime } from "./memo-cache";
const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch: fetch }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture.test" }));
let update: typeof import("./memo-save").updateScheduleItemInCache;
let refresh: typeof import("./memo-save").refreshMemoConflict;
beforeAll(async () => ({ updateScheduleItemInCache: update, refreshMemoConflict: refresh } = await import("./memo-save")));
beforeEach(() => { fetch.mockReset(); });
const item = { itemId: 1, scheduleId: 10, googlePlaceId: "p", startTime: null, endTime: null, memo: "old", memoVersion: 2, orderIndex: 0, travelMode: "DRIVING", createdAt: "2026-09-17T00:00:00Z" };
const args = { roomId: "r", scheduleId: 10, itemId: 1, body: { memo: "draft", expectedMemoVersion: 2 } };
const key = scheduleItemsQueryKey("r", 10);
function setup() { const qc = createQueryClient(); qc.setQueryData(key, [{ id: "item-1", title: "place", ...item }]); return qc; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

describe("memo save lifecycle", () => {
  it("saves the exact versioned payload and preserves concurrent time data", async () => {
    const qc = setup(); const response = deferred<Response>(); fetch.mockReturnValue(response.promise);
    const pending = update(qc, args);
    qc.setQueryData(key, [{ id: "item-1", title: "place", ...item, startTime: "12:00" }]);
    response.resolve(new Response(JSON.stringify({ ...item, memo: "draft", memoVersion: 3 })));
    await pending;
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ memo: "draft", expectedMemoVersion: 2 });
    expect(qc.getQueryData(key)).toMatchObject([{ memo: "draft", memoVersion: 3, startTime: "12:00" }]);
  });
  it("blocks duplicate same-item saves synchronously but permits independent items", async () => {
    const qc = setup(); qc.setQueryData(key, [{ ...item, id: "item-1", title: "one" }, { ...item, itemId: 2, id: "item-2", title: "two" }]);
    const response = deferred<Response>(); fetch.mockReturnValueOnce(response.promise).mockResolvedValueOnce(new Response(JSON.stringify({ ...item, itemId: 2, memo: "two", memoVersion: 3 })));
    const first = update(qc, args);
    await expect(update(qc, args)).rejects.toThrow();
    await update(qc, { ...args, itemId: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
    response.resolve(new Response(JSON.stringify({ ...item, memo: "draft", memoVersion: 3 }))); await first;
  });
  it.each(["deleted", "moved"])("does not resurrect a %s item from a late save", async () => {
    const qc = setup(); const response = deferred<Response>(); fetch.mockReturnValue(response.promise);
    const pending = update(qc, args);
    advanceScheduleLifetime(qc, "r"); qc.setQueryData(key, []);
    response.resolve(new Response(JSON.stringify({ ...item, memo: "draft", memoVersion: 3 })));
    await expect(pending).rejects.toThrow(); expect(qc.getQueryData(key)).toEqual([]);
  });
  it("never retries a 409 and fetches latest without applying stale versions", async () => {
    const qc = setup();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "SCHEDULE_MEMO_CONFLICT", message: "changed" }), { status: 409 }));
    await expect(update(qc, args)).rejects.toMatchObject({ status: 409, code: "SCHEDULE_MEMO_CONFLICT" });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([{ ...item, memo: "latest", memoVersion: 4 }])));
    expect(await refresh(qc, args)).toMatchObject({ memo: "latest", memoVersion: 4 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("accepts a successful save when another item's structure changes", async () => {
    const qc = setup(); const response = deferred<Response>(); fetch.mockReturnValue(response.promise);
    const pending = update(qc, args);
    advanceScheduleLifetime(qc, "r");
    response.resolve(new Response(JSON.stringify({ ...item, memo: "draft", memoVersion: 3 })));
    await expect(pending).resolves.toMatchObject({ memo: "draft", memoVersion: 3 });
  });
  it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid raw conflict version %s even with valid cached version", async (memoVersion) => {
    const qc = setup(); fetch.mockResolvedValue(new Response(JSON.stringify([{ ...item, memo: "remote", memoVersion }])));
    await expect(refresh(qc, args)).rejects.toThrow();
  });
  it("leaves the displayed memo unchanged on failure", async () => {
    const qc = setup(); fetch.mockRejectedValue(new Error("offline"));
    await expect(update(qc, args)).rejects.toThrow("offline");
    expect(qc.getQueryData(key)).toMatchObject([{ memo: "old", memoVersion: 2 }]);
  });
  it("rejects missing items during conflict refresh instead of creating them", async () => {
    const qc = setup(); fetch.mockResolvedValue(new Response("[]"));
    await expect(refresh(qc, args)).rejects.toMatchObject({ status: 404 });
  });
});
