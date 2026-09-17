import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/lib/query-client";
import { scheduleItemsQueryKey, roomSchedulesQueryKey } from "@/lib/query-keys";

describe("memo cache ingress", () => {
  it("rejects older full hydration and accepts its independent order/time", () => {
    const qc = createQueryClient();
    const key = scheduleItemsQueryKey("r", 10);
    qc.setQueryData(key, [{ id: "item-1", itemId: 1, memo: "new", memoVersion: 5 }]);
    qc.setQueryData(key, [{ id: "item-2", itemId: 2 }, { id: "item-1", itemId: 1, memo: "old", memoVersion: 2, startTime: "10:00" }]);
    expect(qc.getQueryData(key)).toEqual([{ id: "item-2", itemId: 2 }, { id: "item-1", itemId: 1, memo: "new", memoVersion: 5, startTime: "10:00" }]);
  });
  it("shares newest memo across includeItems and moved item caches without merging structure", () => {
    const qc = createQueryClient();
    qc.setQueryData(scheduleItemsQueryKey("r", 10), [{ id: "item-1", itemId: 1, memo: "new", memoVersion: 5 }]);
    qc.setQueryData(roomSchedulesQueryKey("r"), [{ scheduleId: 11, items: [{ itemId: 1, memo: "old", memoVersion: 2 }] }]);
    expect(qc.getQueryData(roomSchedulesQueryKey("r"))).toEqual([{ scheduleId: 11, items: [{ itemId: 1, memo: "new", memoVersion: 5 }] }]);
    qc.setQueryData(scheduleItemsQueryKey("r", 11), [{ id: "item-1", itemId: 1, memo: "old", memoVersion: 2 }]);
    expect(qc.getQueryData(scheduleItemsQueryKey("r", 11))).toEqual([{ id: "item-1", itemId: 1, memo: "new", memoVersion: 5 }]);
    qc.setQueryData(scheduleItemsQueryKey("r", 10), []);
    expect(qc.getQueryData(scheduleItemsQueryKey("r", 10))).toEqual([]);
    qc.setQueryData(scheduleItemsQueryKey("other", 10), [{ itemId: 1, memo: "other", memoVersion: 0 }]);
    expect(qc.getQueryData(scheduleItemsQueryKey("other", 10))).toEqual([{ itemId: 1, memo: "other", memoVersion: 0 }]);
  });
});
