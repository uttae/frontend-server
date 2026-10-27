import * as maps from "@/lib/maps";
import { describe, expect, it } from "vitest";

type GoogleMapsUrlModule = typeof maps & {
  buildGoogleMapsDirectionsUrl: (input: {
    originPlaceId: string;
    originQuery: string;
    destinationPlaceId: string;
    destinationQuery: string;
    travelMode: "WALKING" | "TRANSIT" | "DRIVING";
  }) => string | null;
};

describe("buildGoogleMapsDirectionsUrl", () => {
  it("두 장소와 현재 이동수단을 Google Maps 길찾기 URL로 인코딩한다", () => {
    expect(maps).toHaveProperty("buildGoogleMapsDirectionsUrl");

    const { buildGoogleMapsDirectionsUrl } = maps as GoogleMapsUrlModule;
    const url = new URL(
      buildGoogleMapsDirectionsUrl({
        originPlaceId: " ChIJ-origin ",
        originQuery: " 서울역 ",
        destinationPlaceId: "ChIJ-destination",
        destinationQuery: " 성수 카페 & 베이커리 ",
        travelMode: "TRANSIT",
      }) ?? "",
    );

    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("서울역");
    expect(url.searchParams.get("origin_place_id")).toBe("ChIJ-origin");
    expect(url.searchParams.get("destination")).toBe("성수 카페 & 베이커리");
    expect(url.searchParams.get("destination_place_id")).toBe(
      "ChIJ-destination",
    );
    expect(url.searchParams.get("travelmode")).toBe("transit");
  });

  it("출발지나 도착지 ID가 비어 있으면 링크를 만들지 않는다", () => {
    expect(maps).toHaveProperty("buildGoogleMapsDirectionsUrl");

    const { buildGoogleMapsDirectionsUrl } = maps as GoogleMapsUrlModule;
    expect(
      buildGoogleMapsDirectionsUrl({
        originPlaceId: " ",
        originQuery: "서울역",
        destinationPlaceId: "ChIJ-destination",
        destinationQuery: "성수",
        travelMode: "WALKING",
      }),
    ).toBeNull();
  });
});
