// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MapRouteView } from "./Map";

const map = vi.hoisted(() => ({
  center: { lat: 37.5, lng: 127 },
  panTo: vi.fn(),
  setCenter: vi.fn(),
  setZoom: vi.fn(),
  fitBounds: vi.fn(),
  getZoom: () => 15,
  getCenter() {
    return { lat: () => this.center.lat, lng: () => this.center.lng };
  },
  getDiv: () => ({ clientWidth: 390, clientHeight: 700 }),
}));
vi.mock("@vis.gl/react-google-maps", () => ({ useMap: () => map }));
import { RouteViewCameraController } from "./RouteViewCameraController";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const first = { itemId: 1, lat: 37.5, lng: 127 };
const second = { itemId: 2, lat: 37.7, lng: 128 };
const camera: MapRouteView["camera"] = { kind: "pan", seq: 1 };

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  map.center = { lat: 37.5, lng: 127 };
  [map.panTo, map.setCenter, map.setZoom, map.fitBounds].forEach((fn) => fn.mockClear());
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

async function render(focusedItemId: number, locations: MapRouteView["locations"], cam = camera) {
  await act(async () => root.render(<RouteViewCameraController camera={cam} locations={locations}
    focusedItemId={focusedItemId} expanded={false} candidate={null} />));
}

it("선택 장소 위치가 늦게 도착하면 그 위치로 이동한다", async () => {
  await render(2, [first]);
  expect(map.panTo).not.toHaveBeenCalled();
  await render(2, [first, second]);
  expect(map.panTo).toHaveBeenCalledWith(expect.objectContaining({ lng: 128 }));
});

it("삭제 후 선택이 다음 장소로 바뀌면 같은 카메라 요청에서도 이동한다", async () => {
  await render(1, [first, second]);
  map.panTo.mockClear();
  await render(2, [second]);
  expect(map.panTo).toHaveBeenCalledWith(expect.objectContaining({ lng: 128 }));
});

const incheon = { itemId: 10, lat: 37.46, lng: 126.44 };
const sanFrancisco = { itemId: 11, lat: 37.76, lng: -122.41 };
const santaClara = { itemId: 12, lat: 37.32, lng: -121.99 };
const losAngeles = { itemId: 13, lat: 34.05, lng: -118.24 };

it("날짜변경선을 넘는 쪽이 가까운 장소로는 경계에 막히지 않게 바로 옮긴다", async () => {
  await render(11, [incheon, sanFrancisco]);
  expect(map.panTo).not.toHaveBeenCalled();
  expect(map.setCenter).toHaveBeenCalledWith(expect.objectContaining({ lng: -122.41 }));
});

it("일차가 줌 9 한 화면에 안 들어가면 고른 장소 쪽 장소만 맞춘다", async () => {
  await render(11, [incheon, sanFrancisco, losAngeles, santaClara], { kind: "fit", seq: 1 });
  expect(map.fitBounds).toHaveBeenCalledWith(
    expect.objectContaining({ west: -122.41, east: -121.99 }),
    expect.anything(),
  );
});

it("고른 장소 말고 함께 들어가는 장소가 없으면 그 장소를 가까이 보여 준다", async () => {
  await render(11, [incheon, sanFrancisco, losAngeles], { kind: "fit", seq: 1 });
  expect(map.fitBounds).not.toHaveBeenCalled();
  expect(map.setZoom).toHaveBeenCalledWith(15);
});
