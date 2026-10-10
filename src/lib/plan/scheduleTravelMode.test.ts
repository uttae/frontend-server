import { describe, expect, it } from "vitest";

import {
  SCHEDULE_TRAVEL_MODE_DEFAULT,
  SCHEDULE_TRAVEL_MODES,
  canonicalScheduleTravelMode,
  scheduleTravelModeLabel,
} from "./scheduleTravelMode";

describe("scheduleTravelMode", () => {
  it("고를 수 있는 이동수단에 자전거가 없다", () => {
    expect(SCHEDULE_TRAVEL_MODES.map((m) => m.value)).toEqual(["WALKING", "TRANSIT", "DRIVING"]);
  });

  it("예전에 자전거로 저장된 값은 기본값(자동차)으로 읽는다", () => {
    expect(SCHEDULE_TRAVEL_MODE_DEFAULT).toBe("DRIVING");
    expect(canonicalScheduleTravelMode("BICYCLING")).toBe("DRIVING");
    expect(canonicalScheduleTravelMode("cycling")).toBe("DRIVING");
    expect(scheduleTravelModeLabel("BICYCLING")).toBe("자동차");
  });

  it("표준 수단과 예전 별칭은 그대로 읽는다", () => {
    expect(canonicalScheduleTravelMode("walk")).toBe("WALKING");
    expect(canonicalScheduleTravelMode("TRANSIT")).toBe("TRANSIT");
    expect(canonicalScheduleTravelMode("")).toBeNull();
    expect(canonicalScheduleTravelMode("BOAT")).toBeNull();
  });
});
