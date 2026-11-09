// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDebouncedPlacePredictions } from "./useDebouncedPlacePredictions";

const sdk = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/placesAutocompleteSuggest", () => ({
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS: 250,
  fetchPlacePredictionsForRequest: sdk.fetch,
  newAutocompleteSessionToken: () => ({}),
}));

type Hook = ReturnType<typeof useDebouncedPlacePredictions>;
const buildRequest = (input: string) => ({ input }) as google.maps.places.AutocompleteRequest;
let api: Hook, root: Root, host: HTMLDivElement;
function Harness() {
  const hook = useDebouncedPlacePredictions({ placesLibReady: true, minInputLength: 2, buildRequest });
  useEffect(() => {
    api = hook;
  });
  return null;
}
function deferred() {
  let resolve!: (list: unknown[]) => void;
  const promise = new Promise<unknown[]>((r) => { resolve = r; });
  return { promise, resolve };
}
const prediction = (text: string) => ({ placeId: text }) as unknown as google.maps.places.PlacePrediction;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  sdk.fetch.mockReset();
  host = document.createElement("div");
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

// 예: '도쿄' 요청이 가는 중에 Enter로 검색하면, 늦게 온 '도쿄' 추천이 검색 뒤에 목록을 다시 열었다
it("a response that arrives after the list is closed does not reopen it", async () => {
  const first = deferred();
  sdk.fetch.mockReturnValueOnce(first.promise);
  await act(async () => api.scheduleFetch("도쿄"));
  await act(async () => vi.advanceTimersByTimeAsync(250));
  await act(async () => api.clearSuggestionUi());
  await act(async () => first.resolve([prediction("도쿄")]));
  expect(api.isOpen).toBe(false);
  expect(api.predictions).toEqual([]);
});

it("a response that arrives after the input got too short does not reopen the list", async () => {
  const first = deferred();
  sdk.fetch.mockReturnValueOnce(first.promise);
  await act(async () => api.scheduleFetch("도쿄"));
  await act(async () => vi.advanceTimersByTimeAsync(250));
  await act(async () => api.scheduleFetch("도"));
  await act(async () => first.resolve([prediction("도쿄")]));
  expect(api.isOpen).toBe(false);
});

it("typing again ignores the previous response and shows only the new one", async () => {
  const first = deferred();
  sdk.fetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce([prediction("도쿄타워")]);
  await act(async () => api.scheduleFetch("도쿄"));
  await act(async () => vi.advanceTimersByTimeAsync(250));
  await act(async () => api.scheduleFetch("도쿄타"));
  await act(async () => first.resolve([prediction("도쿄")]));
  expect(api.isOpen).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(250));
  expect(api.predictions.map((p) => p.placeId)).toEqual(["도쿄타워"]);
  expect(api.isOpen).toBe(true);
});

it("closing before the debounce fires sends no request", async () => {
  await act(async () => api.scheduleFetch("도쿄"));
  await act(async () => root.unmount());
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(sdk.fetch).not.toHaveBeenCalled();
  root = createRoot(host);
});
