import { expect, test } from "vitest";

import { flattenPlanItinerarySegmentsFromPlaces } from "./planItineraryMapSegments";

function flattenTravelMode(travelMode?: string) {
  const [segment] = flattenPlanItinerarySegmentsFromPlaces(
    [7],
    [
      [
        {
          id: "a",
          itemId: 10,
          title: "출발",
          googlePlaceId: "origin",
          ...(travelMode === undefined ? {} : { travelMode }),
        },
        { id: "b", itemId: 11, title: "도착", googlePlaceId: "destination" },
      ],
    ],
  );

  return segment?.travelModeCanon;
}

test("구간별 선택 이동수단을 지도 경로 descriptor에 반영한다", () => {
  expect(flattenTravelMode("WALKING")).toBe("WALKING");
});

test("소문자 이동수단을 표준값으로 정규화한다", () => {
  expect(flattenTravelMode("walking")).toBe("WALKING");
});

test.each([undefined, "", "BICYCLING", "CYCLING", "BOAT"])("미지원 수단 %s의 지도 경로를 만들지 않는다", (mode) => {
  expect(flattenTravelMode(mode)).toBeUndefined();
});
