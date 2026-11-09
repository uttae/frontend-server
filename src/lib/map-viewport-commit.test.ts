// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { settleSearchSnapshotAfterMove } from "./map-viewport-commit";
import { useMapCenterStore } from "@/stores/map-center-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";

const searched = { center: { lat: 0, lng: 0 }, zoom: 10, radius: 5000 };

function fakeMap() {
  const div = document.createElement("div");
  const handlers = new Map<string, () => void>();
  return {
    div,
    fire: (name: string) => handlers.get(name)?.(),
    map: {
      getDiv: () => div,
      addListener: (name: string, handler: () => void) => {
        handlers.set(name, handler);
        return { remove: () => handlers.delete(name) };
      },
    },
  };
}

beforeEach(() => {
  useSearchRecenterStore.setState({ searchSnapshot: searched });
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 }, zoom: 14, radiusMeters: 1500 });
});

// 카페 검색 결과에 맞춰 지도가 확대되면 그 화면이 기준점이라 버튼이 보이지 않는다
it("takes the settled result camera as the search-here baseline", () => {
  const { map, fire } = fakeMap();
  settleSearchSnapshotAfterMove(map);
  fire("idle");
  expect(useSearchRecenterStore.getState().searchSnapshot).toEqual({ center: { lat: 1, lng: 2 }, zoom: 14, radius: 1500 });
});

it.each(["pointerdown", "wheel"])("keeps the searched area when the user %s the map before it settles", (event) => {
  const { map, div, fire } = fakeMap();
  settleSearchSnapshotAfterMove(map);
  div.dispatchEvent(new Event(event));
  fire("idle");
  expect(useSearchRecenterStore.getState().searchSnapshot).toEqual(searched);
});

it("does not restore a search the user already cleared", () => {
  const { map, fire } = fakeMap();
  settleSearchSnapshotAfterMove(map);
  useSearchRecenterStore.getState().clearSearchSnapshot();
  fire("idle");
  expect(useSearchRecenterStore.getState().searchSnapshot).toBeNull();
});
