import { describe, expect, it } from "vitest";

import { roomCoverForId } from "@/lib/room-cover";

describe("roomCoverForId", () => {
  it("keeps the same room cover across repeated selections", () => {
    const firstCover = roomCoverForId("room-42");

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(roomCoverForId("room-42")).toBe(firstCover);
    }
  });

  it("spreads rooms across the supplied cover images", () => {
    const covers = new Set(
      Array.from({ length: 100 }, (_, index) => roomCoverForId(`room-${index}`)),
    );

    expect(covers.size).toBe(9);
    for (const cover of covers) {
      expect(cover).toMatch(/^\/rooms\/covers\/.+\.webp$/);
    }
  });
});
