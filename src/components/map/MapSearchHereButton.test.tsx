// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MapSearchHereButton } from "./MapSearchHereButton";
import { useMapCenterStore } from "@/stores/map-center-store";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { useSearchRecenterStore } from "@/stores/search-recenter-store";

let root: Root, host: HTMLDivElement;
const searched = { center: { lat: 35.7, lng: 139.8 }, zoom: 15, radius: 1000 };

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  usePlaceSearchStore.getState().clear();
  useMapCenterStore.setState({ mapCenter: searched.center, zoom: 15 });
  useSearchRecenterStore.getState().setSearchSnapshot(searched);
  host = document.createElement("div");
  root = createRoot(host);
  await act(async () => root.render(<MapSearchHereButton discoverCategoryId={null} discoverFailed={false} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  useSearchRecenterStore.getState().clearSearchSnapshot();
  useSearchRecenterStore.getState().clearDiscoverSnapshot();
  usePlaceSearchStore.getState().clear();
});

const button = () => host.querySelector("button");
const notice = () => host.querySelector('[role="status"]');
const finishSearch = (state: Partial<ReturnType<typeof usePlaceSearchStore.getState>>) =>
  act(async () => usePlaceSearchStore.setState(state));

it("shows nothing while the map shows the searched area", () => {
  expect(button()).toBeNull();
});

it("turns into 다시 시도 when search here fails and asks search here again", async () => {
  await finishSearch({ searchMode: "map_recenter", status: "error" });
  expect(button()?.textContent).toBe("다시 시도");
  const before = useSearchRecenterStore.getState().searchRecenterRequestId;
  await act(async () => button()!.click());
  expect(useSearchRecenterStore.getState().searchRecenterRequestId).toBe(before + 1);
});

it("a search box failure leaves the button alone", async () => {
  await finishSearch({ searchMode: "text", status: "error" });
  expect(button()).toBeNull();
});

it("shows 검색 결과가 없어요 until closed, and again for the next search here", async () => {
  await finishSearch({ searchMode: "map_recenter", status: "done", items: [] });
  expect(notice()?.textContent).toBe("검색 결과가 없어요");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="안내 닫기"]')!.click());
  expect(notice()).toBeNull();
  await act(async () => { usePlaceSearchStore.getState().invalidate(); });
  await finishSearch({ searchMode: "map_recenter", status: "done", items: [] });
  expect(notice()).not.toBeNull();
});

it("goes back to 현 위치에서 검색 when the map moves after a failure", async () => {
  await finishSearch({ searchMode: "map_recenter", status: "error" });
  await act(async () => useMapCenterStore.setState({ mapCenter: { lat: 35.8, lng: 139.8 } }));
  expect(button()?.textContent).toBe("현 위치에서 검색");
});

// 카테고리 칩으로 찾은 뒤 「현 위치에서 검색」이 실패해도(결과 없음이 아니라 오류) 같은 자리에서 다시 시도한다
it("turns into 다시 시도 when the category search fails and asks the category search again", async () => {
  useSearchRecenterStore.getState().setDiscoverSnapshot({
    ...searched,
    bounds: { south: 35.69, west: 139.79, north: 35.71, east: 139.81 },
  });
  await act(async () => root.render(<MapSearchHereButton discoverCategoryId="restaurant" discoverFailed />));
  expect(button()?.textContent).toBe("다시 시도");
  const before = useSearchRecenterStore.getState().discoverRecenterRequestId;
  await act(async () => button()!.click());
  expect(useSearchRecenterStore.getState().discoverRecenterRequestId).toBe(before + 1);
});

it("goes back to 현 위치에서 검색 when the map moves after a category failure", async () => {
  useSearchRecenterStore.getState().setDiscoverSnapshot({
    ...searched,
    bounds: { south: 35.69, west: 139.79, north: 35.71, east: 139.81 },
  });
  await act(async () => root.render(<MapSearchHereButton discoverCategoryId="restaurant" discoverFailed />));
  await act(async () => useMapCenterStore.setState({ mapCenter: { lat: 35.8, lng: 139.8 } }));
  expect(button()?.textContent).toBe("현 위치에서 검색");
});
