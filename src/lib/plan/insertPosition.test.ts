import { describe, expect, it } from "vitest";

import { insertPositionAfterItem } from "./insertPosition";
import type { PlanPlace } from "./types";

const place = (itemId: number) => ({ id: `p${itemId}`, itemId }) as PlanPlace;
const places = [place(10), place(20), place(30)];

describe("insertPositionAfterItem", () => {
  it("기준 장소 바로 뒤 위치를 돌려준다", () => {
    expect(insertPositionAfterItem(places, 10)).toEqual({ index: 1, anchorMissing: false });
    expect(insertPositionAfterItem(places, 30)).toEqual({ index: 3, anchorMissing: false });
  });

  it("기준이 없으면 맨 뒤", () => {
    expect(insertPositionAfterItem(places, null)).toEqual({ index: 3, anchorMissing: false });
    expect(insertPositionAfterItem([], null)).toEqual({ index: 0, anchorMissing: false });
  });

  it("기준 장소가 삭제됐으면 맨 뒤에 넣고 알린다", () => {
    expect(insertPositionAfterItem(places, 99)).toEqual({ index: 3, anchorMissing: true });
  });
});
