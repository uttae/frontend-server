import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { issuePlaceSession, autocompletePlaces, resolvePlaceSession } from "./place-sessions";
vi.mock("./client", () => ({ apiFetch: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });
it("authenticated issuance has no body, forwards abort signal and epoch expiry", async () => {
  const controller = new AbortController();
  vi.mocked(apiFetch).mockResolvedValue(Response.json({ sessionToken: "server", expiresAt: 1791960000000 }, { status: 201 }));
  expect(await issuePlaceSession(controller.signal)).toEqual({ sessionToken: "server", expiresAt: 1791960000000 });
  expect(apiFetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/places/sessions"), { method: "POST", signal: controller.signal });
});
it("AbortError propagates without error remapping or paid retry", async () => {
  const error = new DOMException("aborted", "AbortError");
  vi.mocked(apiFetch).mockRejectedValue(error);
  await expect(resolvePlaceSession("same", "chosen")).rejects.toBe(error);
  expect(apiFetch).toHaveBeenCalledTimes(1);
});
it("nullable autocomplete text and codepoint offsets survive wire unchanged", async () => {
  vi.mocked(apiFetch).mockResolvedValue(Response.json({ suggestions: [{ placePrediction: { placeId: "id", text: null, structuredFormat: { mainText: { text: "가😀나", matches: [{ startOffset: 1, endOffset: 2 }] }, secondaryText: null } } }] }));
  const data = await autocompletePlaces({ sessionToken: "server", input: "가", latitude: 37, longitude: 127 });
  expect(data.suggestions[0].placePrediction.structuredFormat?.mainText?.matches).toEqual([{ startOffset: 1, endOffset: 2 }]);
  expect(data.suggestions[0].placePrediction.text).toBeNull();
});
