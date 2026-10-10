import { describe, expect, it } from "vitest";

import {
  analyticsEntryPoint,
  analyticsPagePath,
  buildAnalyticsPageView,
  buildAnalyticsEventPageContext,
  bucketItemCount,
  bucketMemberCount,
  bucketResultCount,
  bucketSearchRank,
  bucketTripDays,
  toAnalyticsRoomRole,
} from "@/lib/analytics/context";

describe("analytics context", () => {
  it.each([
    [0, "0"],
    [1, "1"],
    [2, "2"],
    [3, "3_4"],
    [4, "3_4"],
    [5, "5_plus"],
  ] as const)("buckets %i room members as %s", (count, expected) => {
    expect(bucketMemberCount(count)).toBe(expected);
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [2, "2_3"],
    [3, "2_3"],
    [4, "4_7"],
    [7, "4_7"],
    [8, "8_plus"],
  ] as const)("buckets %i itinerary items as %s", (count, expected) => {
    expect(bucketItemCount(count)).toBe(expected);
  });

  it.each([
    [0, "0"],
    [1, "1_5"],
    [5, "1_5"],
    [6, "6_20"],
    [20, "6_20"],
    [21, "21_plus"],
  ] as const)("buckets %i search results as %s", (count, expected) => {
    expect(bucketResultCount(count)).toBe(expected);
  });

  it.each([
    [0, "1_3"],
    [2, "1_3"],
    [3, "4_10"],
    [9, "4_10"],
    [10, "11_plus"],
  ] as const)("buckets zero-based rank %i as %s", (index, expected) => {
    expect(bucketSearchRank(index)).toBe(expected);
  });

  it("calculates inclusive trip-day buckets", () => {
    expect(bucketTripDays("2026-07-19", "2026-07-19")).toBe("1");
    expect(bucketTripDays("2026-07-19", "2026-07-21")).toBe("2_3");
    expect(bucketTripDays("2026-07-19", "2026-07-25")).toBe("4_7");
    expect(bucketTripDays("2026-07-19", "2026-07-26")).toBe("8_plus");
  });

  it("omits trip-day buckets for missing or invalid ranges", () => {
    expect(bucketTripDays(null, "2026-07-19")).toBeUndefined();
    expect(bucketTripDays("invalid", "2026-07-19")).toBeUndefined();
    expect(bucketTripDays("2026-07-20", "2026-07-19")).toBeUndefined();
  });

  it.each([
    ["/search?q=home&inviteCode=secret", "/search"],
    ["/join/invite-secret#details", "/join/[inviteCode]"],
    ["/plan/123?roomTitle=Jeju", "/plan/[roomId]"],
    ["/packing/room-secret/", "/packing/[roomId]"],
    ["/bookmark/456/", "/bookmark/[folderId]"],
    ["/privacy", "/privacy"],
    ["not-a-path", "/"],
  ] as const)("normalizes analytics page path %s to %s", (pathname, expected) => {
    expect(analyticsPagePath(pathname)).toBe(expected);
  });

  it("builds a page view without URL identifiers or query parameters", () => {
    expect(
      buildAnalyticsPageView({
        origin: "https://uttae.example/",
        pathname: "/plan/room-secret?roomTitle=Jeju",
        referrer:
          "https://uttae.example/join/invite-secret?utm_source=message",
        title: "제주 여행 일정",
      }),
    ).toEqual({
      page_path: "/plan/[roomId]",
      page_location: "https://uttae.example/plan/[roomId]",
      page_referrer: "https://uttae.example/join/[inviteCode]",
      page_title: "제주 여행 일정",
    });
  });

  it("removes packing room IDs from page views, referrers, and event context", () => {
    expect(buildAnalyticsPageView({
      origin: "https://uttae.example",
      pathname: "/packing/room-secret",
      referrer: "https://uttae.example/packing/previous-room",
      title: "준비물",
    })).toEqual({
      page_path: "/packing/[roomId]",
      page_location: "https://uttae.example/packing/[roomId]",
      page_referrer: "https://uttae.example/packing/[roomId]",
      page_title: "준비물",
    });
    expect(buildAnalyticsEventPageContext("https://uttae.example", "/packing/room-secret"))
      .toEqual({ page_path: "/packing/[roomId]", page_location: "https://uttae.example/packing/[roomId]" });
  });

  it("keeps only the origin root for an external HTTP referrer", () => {
    expect(
      buildAnalyticsPageView({
        origin: "https://uttae.example",
        pathname: "/home",
        referrer:
          "https://user:password@search.example:8443/private/result?utm_source=message#details",
        title: "홈",
      }),
    ).toEqual({
      page_path: "/home",
      page_location: "https://uttae.example/home",
      page_referrer: "https://search.example:8443/",
      page_title: "홈",
    });
  });

  it.each([
    "mailto:person@example.com",
    "ftp://files.example/private/path",
    "javascript:alert('secret')",
  ])("omits a non-HTTP referrer: %s", (referrer) => {
    expect(
      buildAnalyticsPageView({
        origin: "https://uttae.example",
        pathname: "/home",
        referrer,
        title: "홈",
      }),
    ).not.toHaveProperty("page_referrer");
  });

  it("keeps standard campaign parameters and removes other query data", () => {
    expect(
      buildAnalyticsPageView({
        origin: "https://uttae.example",
        pathname: "/search",
        referrer:
          "https://campaign.example/landing/private?utm_medium=email&q=other-secret#offer",
        search:
          "?q=raw-search&utm_id=summer-2026&utm_source=newsletter&utm_medium=email&utm_campaign=summer&utm_source_platform=mailchimp&utm_term=travel&utm_content=hero&utm_creative_format=banner&utm_marketing_tactic=prospecting#details",
        title: "검색",
      }),
    ).toEqual({
      page_path: "/search",
      page_location:
        "https://uttae.example/search?utm_id=summer-2026&utm_source=newsletter&utm_medium=email&utm_campaign=summer&utm_source_platform=mailchimp&utm_term=travel&utm_content=hero&utm_creative_format=banner&utm_marketing_tactic=prospecting",
      page_referrer: "https://campaign.example/",
      page_title: "검색",
    });
  });

  it("omits an invalid page referrer", () => {
    expect(
      buildAnalyticsPageView({
        origin: "https://uttae.example",
        pathname: "/search?q=secret",
        referrer: "not-a-url",
        title: "장소 검색",
      }),
    ).toEqual({
      page_path: "/search",
      page_location: "https://uttae.example/search",
      page_title: "장소 검색",
    });
  });

  it("derives low-cardinality entry points and room roles", () => {
    expect(analyticsEntryPoint("invite-code")).toBe("invite");
    expect(analyticsEntryPoint(null)).toBe("direct");
    expect(toAnalyticsRoomRole("HOST")).toBe("host");
    expect(toAnalyticsRoomRole("MEMBER")).toBe("member");
  });
});
