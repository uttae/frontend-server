// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ ready: false, fetchSuggestions: vi.fn() }));
const placesLibrary = {};
vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: () => sdk.ready ? placesLibrary : null,
}));
vi.mock("@/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ data: { id: 7 } }),
}));

import { MobilePlaceSearchScreen } from "./MobilePlaceSearchScreen";
import { AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS } from "@/lib/placesAutocompleteSuggest";

let root: Root;
let host: HTMLDivElement;
let inputRef: ReturnType<typeof createRef<HTMLInputElement>>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  sdk.ready = false;
  sdk.fetchSuggestions.mockReset().mockResolvedValue({
    suggestions: [{ placePrediction: {
      placeId: "tokyo-station", types: ["train_station"], distanceMeters: null,
      mainText: { text: "도쿄역", matches: [] },
      secondaryText: { text: "일본 도쿄", matches: [] },
      text: { text: "도쿄역 일본 도쿄", matches: [] },
      toPlace: () => ({ id: "tokyo-station" }),
    } }],
  });
  vi.stubGlobal("google", { maps: { places: {
    AutocompleteSessionToken: class {},
    AutocompleteSuggestion: { fetchAutocompleteSuggestions: sdk.fetchSuggestions },
  } } });
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  inputRef = createRef<HTMLInputElement>();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render(open = true) {
  await act(async () => root.render(
    <MobilePlaceSearchScreen open={open} onClose={() => {}} inputRef={inputRef}
      backLabel="뒤로" onSelectPlace={async () => null} />,
  ));
}

async function typeQuery(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(inputRef.current, value);
    inputRef.current!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function finishDebounce() {
  await act(async () => vi.advanceTimersByTimeAsync(AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS));
}

it("shows results for the latest pending input when Places finishes loading", async () => {
  await render();
  await typeQuery("도쿄");
  await typeQuery("도쿄역");
  sdk.ready = true;
  await render();
  await finishDebounce();
  expect(document.querySelector("dialog")?.textContent).toContain("도쿄역");
  expect(sdk.fetchSuggestions).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ input: "도쿄역" }));
});

it("does not resurrect a cleared input when Places finishes loading", async () => {
  await render();
  await typeQuery("도쿄");
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="검색어 지우기"]')!.click());
  sdk.ready = true;
  await render();
  await finishDebounce();
  expect(inputRef.current?.value).toBe("");
  expect(document.querySelector("dialog")?.textContent).toContain("검색 기록");
  expect(sdk.fetchSuggestions).not.toHaveBeenCalled();
});

it("waits until reopening a closed search to retry its pending input", async () => {
  await render();
  await typeQuery("도쿄");
  await render(false);
  sdk.ready = true;
  await render(false);
  await finishDebounce();
  expect(sdk.fetchSuggestions).not.toHaveBeenCalled();
  await render();
  await finishDebounce();
  expect(document.querySelector("dialog")?.textContent).toContain("도쿄역");
});
