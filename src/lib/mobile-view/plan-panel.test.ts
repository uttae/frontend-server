import { describe, expect, it } from "vitest";

import {
  isChatPathname,
  isMobileMapPathname,
  isPlanPathname,
  legacyPlanViewPath,
  mobileScheduleHref,
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
