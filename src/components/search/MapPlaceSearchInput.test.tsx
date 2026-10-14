// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MapPlaceSearchInput } from "./MapPlaceSearchInput";
import { apiFetch } from "@/lib/api/client";
import { useMapCenterStore } from "@/stores/map-center-store";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const sdk = { fetch: vi.mocked(apiFetch) };
let issued = 0;
function autocompleteCalls() { return sdk.fetch.mock.calls.filter(([url]) => String(url).endsWith("/places/autocomplete")); }
let root: Root, host: HTMLDivElement;
const confirm = vi.fn(),
  invalidate = vi.fn();
const p = {
  placeId: "first",
  structuredFormat: { mainText: { text: "추천", matches: null }, secondaryText: { text: "주소", matches: null } },
  text: { text: "추천 주소", matches: null },
};
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  issued = 0;
  useMapCenterStore.setState({ mapCenter: { lat: 1, lng: 2 } });
  sdk.fetch.mockReset().mockImplementation(async (url) => String(url).endsWith("/places/sessions")
    ? Response.json({ sessionToken: `token-${++issued}`, expiresAt: Date.now() + 1800000 }, { status: 201 })
    : Response.json({ suggestions: [{ placePrediction: p }] }));
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
    "원래 모든 결과보기",
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
  let finish!: (v: Response) => void;
  sdk.fetch.mockImplementation(async url => String(url).endsWith("/places/sessions")
    ? Response.json({ sessionToken: "old", expiresAt: Date.now()+60000 }, { status: 201 })
    : new Promise(r => { finish = r; }));
  await type("원래");
  await wait();
  await type("");
  await act(async () => finish(Response.json({ suggestions: [{ placePrediction: p }] })));
  expect(host.textContent).not.toContain("추천");
});
it("ignores old suggestions after new input and rotates consumed token for subsequent typing", async () => {
  await type("첫");
  await wait();
  const token = JSON.parse(autocompleteCalls()[0][1]!.body as string).sessionToken;
  await key("Enter");
  await type("다음");
  await wait();
  expect(JSON.parse(autocompleteCalls()[1][1]!.body as string).sessionToken).not.toBe(token);
  expect(invalidate).toHaveBeenCalled();
});

it("debounces issuance and uses server string token and required map coordinates", async () => {
  await type("첫"); await type("둘"); await type("셋");
  expect(sdk.fetch).not.toHaveBeenCalled(); await wait();
  expect(issued).toBe(1); expect(autocompleteCalls()).toHaveLength(1);
  expect(JSON.parse(autocompleteCalls()[0][1]!.body as string)).toEqual({ sessionToken: "token-1", input: "셋", latitude: 1, longitude: 2 });
});
it("null text is safe and Unicode codepoint match includes entire emoji", async () => {
  sdk.fetch.mockImplementation(async url => String(url).endsWith("/places/sessions")
    ? Response.json({ sessionToken: "unicode", expiresAt: Date.now()+60000 }, { status: 201 })
    : Response.json({ suggestions: [{ placePrediction: { placeId: "unicode", text: null, structuredFormat: { mainText: { text: "가😀나", matches: [{ startOffset: 1, endOffset: 2 }] }, secondaryText: null } } }, { placePrediction: { placeId: "null", text: null, structuredFormat: null } }] }));
  await type("원래"); await wait();
  expect(host.querySelector("mark")?.textContent).toBe("😀");
  expect(host.textContent).toContain("가😀나");
  expect(host.textContent).not.toContain("null");
});
it("expired token cannot resolve selected prediction", async () => {
  await type("원래"); await wait();
  await act(async () => vi.advanceTimersByTimeAsync(1800001));
  await key("ArrowDown"); await key("ArrowDown"); await key("Enter");
  expect(confirm).not.toHaveBeenCalled();
});
it("close abandons predictions so immediate reopen Enter cannot consume old token", async () => {
  await type("원래"); await wait(); await key("Escape");
  await act(async () => host.querySelector("input")!.dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
  await key("Enter");
  expect(confirm.mock.calls[0]?.[0].prediction).toBeUndefined();
});
it("rapid input while session issuance pending stays single-flight and skips stale autocomplete", async () => {
  let finish!: (r: Response) => void;
  sdk.fetch.mockImplementation(async url => String(url).endsWith("/places/sessions")
    ? new Promise(r => { finish = r; })
    : Response.json({ suggestions: [{ placePrediction: p }] }));
  await type("첫"); await wait(); await type("다음"); await wait();
  expect(sdk.fetch.mock.calls.filter(([url]) => String(url).endsWith("/places/sessions"))).toHaveLength(1);
  await act(async () => finish(Response.json({ sessionToken: "slow", expiresAt: Date.now()+60000 }, { status: 201 })));
  expect(autocompleteCalls()).toHaveLength(1);
  expect(JSON.parse(autocompleteCalls()[0][1]!.body as string).input).toBe("다음");
});
it("429 respects shared wait without request loop on further input", async () => {
  sdk.fetch.mockResolvedValue(Response.json({ code: "RATE_LIMIT_EXCEEDED", message: "잠시 후" }, { status: 429, headers: { "Retry-After": "60" } }));
  await type("첫"); await wait(); await type("다음"); await wait();
  expect(sdk.fetch).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("잠시 후");
});
it("nullable structured main text falls back to actual complete prediction text", async () => {
  await act(async () => vi.advanceTimersByTimeAsync(61000));
  sdk.fetch.mockImplementation(async url => String(url).endsWith("/places/sessions")
    ? Response.json({ sessionToken: "nullable-main", expiresAt: Date.now()+60000 }, { status: 201 })
    : Response.json({ suggestions: [{ placePrediction: { placeId: "id", text: { text: "전체 실제 이름", matches: null }, structuredFormat: { mainText: { text: null, matches: null }, secondaryText: null } } }] }));
  await type("원래"); await wait();
  expect(host.querySelectorAll('[role="option"]')[1]?.textContent).toContain("전체 실제 이름");
});
