import { describe, expect, it } from "vitest";

import { formatRoomTripSubtitle } from "./tripRange";

describe("formatRoomTripSubtitle", () => {
  it("shows a trip range as MM/DD ~ MM/DD without the year", () => {
    expect(formatRoomTripSubtitle("2026-10-10", "2026-10-12")).toBe("10/10 ~ 10/12");
    expect(formatRoomTripSubtitle("2026-12-30", "2027-01-02")).toBe("12/30 ~ 01/02");
  });

  it("shows a one-day trip as a single date", () => {
    expect(formatRoomTripSubtitle("2026-10-10", "2026-10-10")).toBe("10/10");
  });

  it("shows 일정 없음 when either date is missing", () => {
    expect(formatRoomTripSubtitle("", "2026-10-12")).toBe("일정 없음");
    expect(formatRoomTripSubtitle("2026-10-10", " ")).toBe("일정 없음");
  });
});
