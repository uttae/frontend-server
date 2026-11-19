import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPlanItineraryRouteConnectorDotIcons,
  buildPlanItineraryRouteConnectorPaths,
  decodePlanSegmentPathLatLng,
} from "./maps";

function stubGeometry(decodePath: (encoded: string) => Array<{ lat(): number; lng(): number }>) {
  const importLibrary = vi.fn(async (name: string) => {
    if (name === "geometry") return { encoding: { decodePath } };
    throw new Error(`unexpected library: ${name}`);
  });
  vi.stubGlobal("google", { maps: { importLibrary } });
  return importLibrary;
}

function latLng(lat: number, lng: number) {
  return { lat: () => lat, lng: () => lng };
}

describe("decodePlanSegmentPathLatLng", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("서버 폴리라인을 디코딩해 좌표 배열로 반환한다", async () => {
    const decodePath = vi.fn(() => [latLng(37.5665, 126.978), latLng(37.5446, 127.0557)]);
    stubGeometry(decodePath);

    await expect(decodePlanSegmentPathLatLng("  _p~iF~ps|U_ulLnnqC  ")).resolves.toEqual([
      { lat: 37.5665, lng: 126.978 },
      { lat: 37.5446, lng: 127.0557 },
    ]);
    expect(decodePath).toHaveBeenCalledWith("_p~iF~ps|U_ulLnnqC");
  });

  it("폴리라인이 없으면 지도 라이브러리를 부르지 않고 빈 경로를 반환한다", async () => {
    const importLibrary = stubGeometry(() => []);

    await expect(decodePlanSegmentPathLatLng(undefined)).resolves.toEqual([]);
    await expect(decodePlanSegmentPathLatLng("   ")).resolves.toEqual([]);
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("디코딩에 실패하면 빈 경로를 반환한다", async () => {
    stubGeometry(() => {
      throw new Error("decode error");
    });

    await expect(decodePlanSegmentPathLatLng("broken")).resolves.toEqual([]);
  });

  it("점선 보조 구간은 큰 점과 80% 불투명도로 표시한다", () => {
    const [dotSequence] = buildPlanItineraryRouteConnectorDotIcons("#123456");

    expect(dotSequence?.icon).toEqual(
      expect.objectContaining({
        fillColor: "#123456",
        fillOpacity: 0.8,
        scale: 5,
      }),
    );
  });
});

describe("buildPlanItineraryRouteConnectorPaths", () => {
  it("경로 path가 실제 장소 좌표까지 닿지 않으면 양끝을 점선 보조 구간으로 연결한다", () => {
    const origin = { lat: 37.5665, lng: 126.978 };
    const dest = { lat: 37.5446, lng: 127.0557 };
    const path = [
      { lat: 37.567, lng: 126.979 },
      { lat: 37.545, lng: 127.0548 },
    ];

    expect(
      buildPlanItineraryRouteConnectorPaths({
        path,
        origin,
        dest,
      }),
    ).toEqual([
      [origin, path[0]],
      [path[1], dest],
    ]);
  });

  it("경로 path를 만들 수 없으면 실제 장소 좌표 사이를 점선 직선으로 연결한다", () => {
    const origin = { lat: 37.5665, lng: 126.978 };
    const dest = { lat: 37.5446, lng: 127.0557 };

    expect(
      buildPlanItineraryRouteConnectorPaths({
        path: [],
        origin,
        dest,
      }),
    ).toEqual([[origin, dest]]);
  });
});
