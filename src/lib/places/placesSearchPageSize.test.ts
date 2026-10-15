import { describe, expect, it } from "vitest";

import { PLACES_SEARCH_PAGE_SIZE } from "@/lib/places/placesSearchPageSize";

describe("PLACES_SEARCH_PAGE_SIZE", () => {
  it("requests up to ten candidates per page", () => {
    expect(PLACES_SEARCH_PAGE_SIZE).toBe(10);
  });
});
