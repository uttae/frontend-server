import { describe, expect, it } from "vitest";

import { segmentSourcesWithChangedNext } from "@/lib/plan/scheduleStompRouteScope";

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

describe("segmentSourcesWithChangedNext", () => {
  it("returns nothing when there was no earlier list to route from", () => {
    expect(segmentSourcesWithChangedNext(null, [1, 2, 3])).toEqual([]);
  });

  it("returns nothing when the order is unchanged", () => {
    expect(segmentSourcesWithChangedNext([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it("collects the sources whose next stop changed after a reorder", () => {
    // [A,X,B,C] → [A,B,X,C]: A·X·B의 다음 장소가 바뀌었고 C는 마지막이라 구간이 없다
    expect(sorted(segmentSourcesWithChangedNext([1, 9, 2, 3], [1, 2, 9, 3]))).toEqual([
      1, 2, 9,
    ]);
  });

  it("includes the removed stop and its predecessor after a deletion", () => {
    expect(sorted(segmentSourcesWithChangedNext([1, 2, 3], [1, 3]))).toEqual([1, 2]);
  });

  it("includes the new stop and its predecessor after an insertion", () => {
    expect(sorted(segmentSourcesWithChangedNext([1, 3], [1, 2, 3]))).toEqual([1, 2]);
  });
});
