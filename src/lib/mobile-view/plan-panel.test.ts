import { describe, expect, it } from "vitest";

import {
  buildMapRouteHref,
  isChatPathname,
  isMobileMapPathname,
  isPlanPathname,
  legacyPlanViewPath,
  mobileScheduleHref,
  readMapRouteParams,
} from "./plan-panel";

describe("mobile plan routes", () => {
  it("일정·지도·채팅 경로를 구분한다", () => {
    expect(isPlanPathname("/plan")).toBe(true);
    expect(isPlanPathname("/plan/room-1")).toBe(true);
    expect(isPlanPathname("/map")).toBe(false);
    expect(isMobileMapPathname("/map")).toBe(true);
    expect(isChatPathname("/chat")).toBe(true);
    expect(isChatPathname("/plan")).toBe(false);
  });

  it("일정 링크는 현재 방 일정 주소를 유지하고, 다른 화면에서는 /plan으로 간다", () => {
    expect(mobileScheduleHref("/plan/room-1")).toBe("/plan/room-1");
    expect(mobileScheduleHref("/map")).toBe("/plan");
    expect(mobileScheduleHref("/bookmark")).toBe("/plan");
  });

  it("예전 ?view= 값은 새 경로로 옮기고, 그 밖의 값은 무시한다", () => {
    expect(legacyPlanViewPath("map")).toBe("/map");
    expect(legacyPlanViewPath("chat")).toBe("/chat");
    expect(legacyPlanViewPath("schedule")).toBeNull();
    expect(legacyPlanViewPath(null)).toBeNull();
  });
});

describe("map route view params", () => {
  it("경로 보기 주소를 만들고, 장소가 있으면 item을 붙인다", () => {
    expect(buildMapRouteHref(2)).toBe("/map?view=route&day=2");
    expect(buildMapRouteHref(1, 115)).toBe("/map?view=route&day=1&item=115");
    expect(buildMapRouteHref(3, null)).toBe("/map?view=route&day=3");
  });

  it("잘못된 day는 1일차로, 잘못된 item은 무시한다", () => {
    const read = (query: string) => readMapRouteParams(new URLSearchParams(query));
    expect(read("view=route&day=4&item=115")).toEqual({ active: true, day: 4, itemId: 115 });
    expect(read("view=route&day=0&item=abc")).toEqual({ active: true, day: 1, itemId: null });
    expect(read("view=route")).toEqual({ active: true, day: 1, itemId: null });
    expect(read("")).toEqual({ active: false, day: 1, itemId: null });
  });
});
