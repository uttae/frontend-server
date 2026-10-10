// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MapRouteView } from "./Map";

const map = vi.hoisted(() => ({ panTo: vi.fn(), getZoom: () => 15 }));
vi.mock("@vis.gl/react-google-maps", () => ({ useMap: () => map }));
import { RouteViewCameraController } from "./RouteViewCameraController";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const first = { itemId: 1, lat: 37.5, lng: 127 };
const second = { itemId: 2, lat: 37.7, lng: 128 };
const camera: MapRouteView["camera"] = { kind: "pan", seq: 1 };

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  map.panTo.mockClear();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); });

async function render(focusedItemId: number, locations: MapRouteView["locations"]) {
  await act(async () => root.render(<RouteViewCameraController camera={camera} locations={locations}
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
