import { describe, expect, it } from "vitest";

import {
  SCHEDULE_TRAVEL_MODES,
  canonicalScheduleTravelMode,
} from "./scheduleTravelMode";

describe("scheduleTravelMode", () => {
  it("고를 수 있는 이동수단에 자전거가 없다", () => {
    expect(SCHEDULE_TRAVEL_MODES.map((m) => m.value)).toEqual(["WALKING", "TRANSIT", "DRIVING"]);
  });

  it.each(["BICYCLING", "CYCLING", "BOAT", "", undefined])("미지원 값 %s를 다른 수단으로 바꾸지 않는다", (mode) => {
    expect(canonicalScheduleTravelMode(mode)).toBeNull();
  });

  it("표준 수단과 예전 별칭은 그대로 읽는다", () => {
    expect(canonicalScheduleTravelMode("walk")).toBe("WALKING");
    expect(canonicalScheduleTravelMode("TRANSIT")).toBe("TRANSIT");
    expect(canonicalScheduleTravelMode("")).toBeNull();
    expect(canonicalScheduleTravelMode("BOAT")).toBeNull();
  });
});
