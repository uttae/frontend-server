// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapPlaceSearchInput } from "./MapPlaceSearchInput";
const sdk = vi.hoisted(() => ({ fetch: vi.fn() }));
const library = {};
vi.mock("@vis.gl/react-google-maps", () => ({ useMapsLibrary: () => library }));
vi.mock("@/lib/placesAutocompleteSuggest", () => ({
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS: 250,
  newAutocompleteSessionToken: () => ({}),
  circleLocationBias: (center: unknown, radius: number) => ({ center, radius }),
  fetchPlacePredictionsForRequest: sdk.fetch,
}));
let root: Root, host: HTMLDivElement;
const confirm = vi.fn(),
  invalidate = vi.fn();
const p = {
  placeId: "first",
  mainText: { text: "추천" },
  secondaryText: { text: "주소" },
  text: { text: "추천 주소" },
};
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  sdk.fetch.mockReset().mockResolvedValue([p]);
  confirm.mockReset().mockResolvedValue(true);
  invalidate.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MapPlaceSearchInput
        onConfirm={confirm}
        onInvalidate={invalidate}
        scopeKey="a"
      />,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
async function type(value: string) {
  await act(async () => {
    const input = host.querySelector("input")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function wait() {
  await act(async () => vi.advanceTimersByTimeAsync(250));
}
async function key(key: string) {
  await act(async () =>
    host
      .querySelector("input")!
      .dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })),
  );
}
it("puts all results first; unselected Enter retains original query and first prediction", async () => {
  await type("원래");
  await wait();
  expect(host.querySelector('[role="option"]')?.textContent).toContain(
    "전체 결과",
  );
  await key("Enter");
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ query: "원래", kind: "whole", prediction: p }),
  );
});
it("arrow-selected recommendation Enter confirms only that prediction", async () => {
  await type("원래");
  await wait();
  await key("ArrowDown");
  await key("ArrowDown");
  await key("Enter");
  expect(confirm).toHaveBeenCalledWith(
    expect.objectContaining({ query: "원래", kind: "specific", prediction: p }),
  );
});
it("rejects blank input and duplicate confirmations", async () => {
  await type(" ");
  await key("Enter");
  expect(confirm).not.toHaveBeenCalled();
  await type("원래");
  await wait();
  confirm.mockReturnValue(new Promise(() => {}));
  await key("Enter");
  await key("Enter");
  expect(confirm).toHaveBeenCalledTimes(1);
});
it("ignores suggestions returned after clear", async () => {
  let finish!: (v: unknown[]) => void;
  sdk.fetch.mockReturnValue(
    new Promise((r) => {
      finish = r;
    }),
  );
  await type("원래");
  await wait();
  await type("");
  await act(async () => finish([p]));
  expect(host.textContent).not.toContain("추천");
});
it("ignores old suggestions after new input and rotates consumed token for subsequent typing", async () => {
  await type("첫");
  await wait();
  const token = sdk.fetch.mock.calls[0][0].sessionToken;
  await key("Enter");
  await type("다음");
  await wait();
  expect(sdk.fetch.mock.calls[1][0].sessionToken).not.toBe(token);
  expect(invalidate).toHaveBeenCalled();
});
