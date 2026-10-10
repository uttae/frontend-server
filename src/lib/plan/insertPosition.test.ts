import { describe, expect, it } from "vitest";

import { insertAnchorAfterItem, resolveInsertIndex } from "./insertPosition";
import type { PlanPlace } from "./types";

const place = (itemId: number) => ({ id: `p${itemId}`, itemId }) as PlanPlace;
const list = (...ids: number[]) => ids.map(place);

describe("insertAnchorAfterItem", () => {
  it("앞·뒤 장소와 위치를 기억한다", () => {
    expect(insertAnchorAfterItem(list(1, 2, 3, 4), 1)).toEqual({ afterItemId: 1, nextItemId: 2, index: 1 });
    expect(insertAnchorAfterItem(list(1, 2, 3, 4), 4)).toEqual({ afterItemId: 4, nextItemId: null, index: 4 });
  });
});

describe("resolveInsertIndex", () => {
  // 1, 2, 3, 4 에서 1과 2 사이에 넣으려던 경우
  const anchor = insertAnchorAfterItem(list(1, 2, 3, 4), 1);

  it("기준이 없으면 맨 뒤", () => {
    expect(resolveInsertIndex(list(1, 2, 3), null)).toBe(3);
  });

  it("앞 장소가 있으면 그 바로 뒤", () => {
    expect(resolveInsertIndex(list(1, 2, 3, 4), anchor)).toBe(1);
    // 그사이 앞에 장소가 늘어도 앞 장소를 따라간다
    expect(resolveInsertIndex(list(9, 1, 2, 3, 4), anchor)).toBe(2);
  });

  it("앞 장소가 삭제됐으면 뒤 장소 앞", () => {
    expect(resolveInsertIndex(list(2, 3, 4), anchor)).toBe(0);
    expect(resolveInsertIndex(list(3, 2, 4), anchor)).toBe(1);
  });

  it("앞·뒤 장소가 모두 없으면 원래 위치, 목록보다 길면 맨 뒤", () => {
    expect(resolveInsertIndex(list(3, 4), anchor)).toBe(1);
    const lastAnchor = insertAnchorAfterItem(list(1, 2, 3, 4), 3);
    expect(resolveInsertIndex(list(1, 2), lastAnchor)).toBe(2);
  });

  it("목록이 비었으면 처음", () => {
    expect(resolveInsertIndex([], anchor)).toBe(0);
  });
});
