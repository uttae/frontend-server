import { describe, expect, it } from "vitest";

import { TRIP_SCHEDULE_DAY_LIMIT_MESSAGE } from "@/lib/plan/schedulePolicy";

import {
  createTripDatesSchema,
  createTripFormSchema,
  TRIP_DATE_RANGE_INVALID_MESSAGE,
  TRIP_DATES_REQUIRED_MESSAGE,
  TRIP_DESTINATIONS_INVALID_MESSAGE,
  TRIP_DESTINATIONS_REQUIRED_MESSAGE,
  TRIP_START_BEFORE_MIN_MESSAGE,
  TRIP_TITLE_REQUIRED_MESSAGE,
  tripDestinationsSchema,
  tripTitleSchema,
} from "./trip-form";

const valid = { title: "봄 여행", destinations: ["서울"], startDate: "2027-01-01", endDate: "2027-01-03" };
const issuesOf = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.error?.issues.map(({ path, message }) => ({ path, message })) ?? [];

describe("createTripFormSchema", () => {
  it("trims title and destinations for submit", () => {
    expect(createTripFormSchema().parse({ ...valid, title: "  봄 여행  ", destinations: [" 서울 ", "부산"] })).toEqual({
      ...valid,
      destinations: ["서울", "부산"],
    });
  });

  it("puts each issue on the field name shown on screen", () => {
    expect(issuesOf(createTripFormSchema().safeParse({ ...valid, title: "  " }))).toEqual([
      { path: ["title"], message: TRIP_TITLE_REQUIRED_MESSAGE },
    ]);
    expect(issuesOf(createTripFormSchema().safeParse({ ...valid, destinations: [] }))).toEqual([
      { path: ["destinations"], message: TRIP_DESTINATIONS_REQUIRED_MESSAGE },
    ]);
    expect(issuesOf(createTripFormSchema().safeParse({ ...valid, destinations: ["서울", "서울"] }))).toEqual([
      { path: ["destinations"], message: TRIP_DESTINATIONS_INVALID_MESSAGE },
    ]);
  });

  it("puts every period issue on endDate", () => {
    const schema = createTripFormSchema({ startDateMin: "2027-01-01" });
    expect(issuesOf(schema.safeParse({ ...valid, endDate: "" }))).toEqual([
      { path: ["endDate"], message: TRIP_DATES_REQUIRED_MESSAGE },
    ]);
    expect(issuesOf(schema.safeParse({ ...valid, startDate: "2026-12-31" }))).toEqual([
      { path: ["endDate"], message: TRIP_START_BEFORE_MIN_MESSAGE },
    ]);
    expect(issuesOf(schema.safeParse({ ...valid, endDate: "2026-12-31" }))).toEqual([
      { path: ["endDate"], message: TRIP_DATE_RANGE_INVALID_MESSAGE },
    ]);
    expect(issuesOf(schema.safeParse({ ...valid, endDate: "2027-03-01" }))).toEqual([
      { path: ["endDate"], message: TRIP_SCHEDULE_DAY_LIMIT_MESSAGE },
    ]);
  });

  it("allows a start date before today when no minimum is given (trip edit)", () => {
    expect(createTripFormSchema().safeParse({ ...valid, startDate: "2000-01-01", endDate: "2000-01-02" }).success).toBe(
      true,
    );
  });
});

describe("field schemas", () => {
  it("validates one field value with no path", () => {
    expect(issuesOf(tripTitleSchema.safeParse(""))).toEqual([{ path: [], message: TRIP_TITLE_REQUIRED_MESSAGE }]);
    expect(issuesOf(tripDestinationsSchema.safeParse(["a", "b", "c", "d", "e", "f"]))).toEqual([
      { path: [], message: TRIP_DESTINATIONS_INVALID_MESSAGE },
    ]);
    expect(issuesOf(createTripDatesSchema().safeParse({ startDate: "2027-01-02", endDate: "2027-01-01" }))).toEqual([
      { path: ["endDate"], message: TRIP_DATE_RANGE_INVALID_MESSAGE },
    ]);
  });
});
