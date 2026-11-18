import { expect, it } from "vitest";

import { scheduleIdsToRouteColors, sortedScheduleIdsForRouteColors } from "./planRouteDayColors";

it("colors the first day with the Figma primary and gives later days their own fixed colors", () => {
  const colors = scheduleIdsToRouteColors(sortedScheduleIdsForRouteColors({ 30: true, 10: false, 20: true }));
  expect(colors.get(10)).toBe("#0183ff");
  expect(new Set([colors.get(10), colors.get(20), colors.get(30)]).size).toBe(3);
  expect(scheduleIdsToRouteColors([10, 20, 30])).toEqual(colors);
});
