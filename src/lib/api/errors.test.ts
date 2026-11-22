import { describe, expect, it } from "vitest";
import { readRoomsRequiringDelegationFromBody, readUserFacingMessageFromApiBody } from "./errors";

describe("API error payload normalization", () => {
  it("accepts numeric room IDs and drops malformed identifiers", () => {
    expect(
      readRoomsRequiringDelegationFromBody({
        roomsRequiringDelegation: [
          { roomId: " room ", title: " Trip " },
          { roomId: 12, title: "Numeric" },
          ...[{}, ["room"], true, null].map((roomId) => ({ roomId, title: "Invalid" })),
        ],
      }),
    ).toEqual([
      { roomId: "room", title: "Trip" },
      { roomId: "12", title: "Numeric" },
    ]);
  });

  it("retains message precedence and first nonempty field error", () => {
    expect(
      readUserFacingMessageFromApiBody({
        message: " direct ",
        error: { message: "nested" },
        errors: { field: ["validation"] },
      }),
    ).toBe("direct");
    expect(
      readUserFacingMessageFromApiBody({ error: { message: " nested " }, errors: { field: ["validation"] } }),
    ).toBe("nested");
    expect(
      readUserFacingMessageFromApiBody({ errors: { first: [null, "  ", " field error ", "later"], second: "other" } }),
    ).toBe("field error");
    expect(readUserFacingMessageFromApiBody({ errors: ["not a field map"] })).toBeUndefined();
  });
});
