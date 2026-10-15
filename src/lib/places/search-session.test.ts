import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmPlaceSearch, terminatePredictionSession } from "./search-session";
import { apiFetch } from "@/lib/api/client";
import { QueryClient } from "@tanstack/react-query";
import { registerQueryClient } from "@/lib/query-client";
import { placeDetailQueryKey } from "./place-queries";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const detail = {
  googlePlaceId: "first", name: "추천 이름", formattedAddress: "주소",
  location: { lat: 37, lng: 127 }, primaryType: "cafe", primaryTypeDisplayName: "카페",
  rating: 4.5, userRatingCount: 2, phoneNumber: null, websiteUri: null,
  googleMapsUri: null, googleMapsLinks: null, regularOpeningHours: null, reviews: [],
};
const response = { detail, source: "GOOGLE", cacheStatus: "MISS", googleDetailsRequested: true, termination: "SUCCEEDED" };
let client: QueryClient;
let clock = Date.now();
beforeEach(() => {
  clock += 61000; vi.spyOn(Date, "now").mockReturnValue(clock);
  client = new QueryClient(); registerQueryClient(client);
  vi.mocked(apiFetch).mockReset().mockResolvedValue(Response.json(response));
});
function setup(overrides = {}) {
  const search = vi.fn().mockResolvedValue([{ googlePlaceId: "other" }]);
  return { search, args: { query: "원래 검색어", kind: "whole" as const,
    prediction: { placeId: "first", text: null, structuredFormat: null },
    session: { sessionToken: "server-token", expiresAt: Date.now() + 60000 },
    mapCenter: { lat: 1, lng: 2 }, isCurrent: () => true, search, ...overrides } };
}
describe("server session confirmation", () => {
  it("resolves same server token once and seeds full raw detail before publishing anchor", async () => {
    const { args, search } = setup();
    const onAnchor = vi.fn(() => expect(client.getQueryData(placeDetailQueryKey("first"))).toEqual(detail));
    const result = await confirmPlaceSearch({ ...args, onAnchor });
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("/places/resolve"), expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionToken: "server-token", googlePlaceId: "first" }) }));
    expect(result?.anchor?.detail).toEqual(detail);
    expect(result?.termination).toBe("SUCCEEDED");
    expect(onAnchor).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledExactlyOnceWith({ query: "원래 검색어", latitude: 37, longitude: 127, radius: 5000 });
  });
  it("frontend cache HIT still resolves; keeps server HIT distinct from termination", async () => {
    client.setQueryData(placeDetailQueryKey("first"), detail);
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ ...response, source: "CACHE", cacheStatus: "HIT", googleDetailsRequested: false, termination: "NOT_TERMINATED" }));
    const { args } = setup({ kind: "specific" });
    const result = await confirmPlaceSearch(args);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(result?.termination).toBe("NOT_TERMINATED");
    expect(result?.anchor?.source).toBe("CACHE");
  });
  it("specific resolves full response with zero Text Search", async () => {
    const { args, search } = setup({ kind: "specific" });
    expect((await confirmPlaceSearch(args))?.anchor?.detail.rating).toBe(4.5);
    expect(search).not.toHaveBeenCalled();
  });
  it.each(["absent", "failed", "null coordinates"])("whole uses map-center fallback for %s without another Google call", async mode => {
    const { args, search } = setup(mode === "absent" ? { prediction: undefined } : {});
    if (mode === "failed") vi.mocked(apiFetch).mockResolvedValue(Response.json({ code: "EXTERNAL_API_ERROR", message: "실패" }, { status: 502 }));
    if (mode === "null coordinates") vi.mocked(apiFetch).mockResolvedValue(Response.json({ ...response, detail: { ...detail, location: null } }));
    const result = await confirmPlaceSearch(args);
    expect(result?.fallback).toBe(true);
    expect(search).toHaveBeenCalledExactlyOnceWith({ query: "원래 검색어", latitude: 1, longitude: 2, radius: 5000 });
    expect(apiFetch).toHaveBeenCalledTimes(mode === "absent" ? 0 : 1);
    if (mode === "null coordinates") expect(result?.termination).toBe("SUCCEEDED");
  });
  it("specific null coordinates cannot fake location or make supplementary requests", async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ ...response, detail: { ...detail, location: null } }));
    const { args, search } = setup({ kind: "specific" });
    await expect(confirmPlaceSearch(args)).rejects.toThrow("좌표");
    expect(apiFetch).toHaveBeenCalledTimes(1); expect(search).not.toHaveBeenCalled();
  });
  it("late resolve cannot seed scope cache or publish search", async () => {
    let finish!: (v: Response) => void; let current = true;
    vi.mocked(apiFetch).mockReturnValue(new Promise(r => { finish = r; }));
    const { args, search } = setup({ isCurrent: () => current });
    const pending = confirmPlaceSearch(args); current = false; finish(Response.json(response));
    expect(await pending).toBeNull();
    expect(client.getQueryData(placeDetailQueryKey("first"))).toBeUndefined();
    expect(search).not.toHaveBeenCalled();
  });
  it("late Text Search suppressed", async () => {
    let finish!: (v: unknown[]) => void; let current = true;
    const { args, search } = setup({ isCurrent: () => current });
    search.mockReturnValue(new Promise(r => { finish = r; }));
    const pending = confirmPlaceSearch(args); await vi.waitFor(() => expect(search).toHaveBeenCalled());
    current = false; finish([]); expect(await pending).toBeNull();
  });
  it("duplicate choices reuse same operation, conflicting place never requests", async () => {
    const { args } = setup();
    const a = terminatePredictionSession(args.prediction, args.session);
    const b = terminatePredictionSession(args.prediction, args.session);
    await Promise.all([a,b]); expect(apiFetch).toHaveBeenCalledTimes(1);
    await expect(terminatePredictionSession({ ...args.prediction, placeId: "other" }, args.session)).rejects.toThrow("이미");
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it.each([[400,"PLACE_SESSION_INVALID"],[409,"PLACE_SESSION_NOT_STARTED"],[409,"PLACE_SESSION_CONFLICT"],[502,"EXTERNAL_API_ERROR"],[409,"PLACE_SESSION_UNCERTAIN"],[503,"PLACE_SESSION_UNAVAILABLE"],[429,"RATE_LIMIT_EXCEEDED"]])("%s %s never automatically retries paid resolve", async (status, code) => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ code, message: "실패" }, { status: Number(status) }));
    const { args } = setup({ kind: "specific" });
    await expect(confirmPlaceSearch(args)).rejects.toMatchObject({ status, code });
    await expect(confirmPlaceSearch(args)).rejects.toMatchObject({ status, code });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it("MISS replay preserves SUCCEEDED despite no Google request this time", async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ ...response, source: "SESSION_REPLAY", googleDetailsRequested: false }));
    const { args } = setup({ kind: "specific" });
    expect((await confirmPlaceSearch(args))?.anchor).toMatchObject({ source: "SESSION_REPLAY", cacheStatus: "MISS", googleDetailsRequested: false, termination: "SUCCEEDED" });
  });
  it("blank/no-center never makes outbound requests", async () => {
    const { args, search } = setup({ prediction: undefined, mapCenter: null });
    await expect(confirmPlaceSearch(args)).rejects.toThrow("지도 위치");
    await expect(confirmPlaceSearch({ ...args, query: " " })).rejects.toThrow("검색어");
    expect(search).not.toHaveBeenCalled(); expect(apiFetch).not.toHaveBeenCalled();
  });
});

it("IN_PROGRESS retries once after delay with identical token/place, then accepts replay", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(Response.json({ code: "PLACE_SESSION_IN_PROGRESS", message: "진행 중" }, { status: 409 })).mockResolvedValueOnce(Response.json({ ...response, source: "SESSION_REPLAY", googleDetailsRequested: false }));
  const { args } = setup({ kind: "specific" });
  const result = await confirmPlaceSearch(args);
  expect(result?.termination).toBe("SUCCEEDED");
  expect(apiFetch).toHaveBeenCalledTimes(2);
  expect(vi.mocked(apiFetch).mock.calls.map(([,init]) => init!.body)).toEqual([JSON.stringify({ sessionToken: "server-token", googlePlaceId: "first" }), JSON.stringify({ sessionToken: "server-token", googlePlaceId: "first" })]);
});
it("persistent IN_PROGRESS is bounded and no subsequent confirmation starts a loop", async () => {
  vi.mocked(apiFetch).mockImplementation(async () => Response.json({ code: "PLACE_SESSION_IN_PROGRESS", message: "진행 중" }, { status: 409 }));
  const { args } = setup({ kind: "specific" });
  await expect(confirmPlaceSearch(args)).rejects.toMatchObject({ code: "PLACE_SESSION_IN_PROGRESS" });
  await expect(confirmPlaceSearch(args)).rejects.toMatchObject({ code: "PLACE_SESSION_IN_PROGRESS" });
  expect(apiFetch).toHaveBeenCalledTimes(2);
});

it("abandoned scope during IN_PROGRESS wait never starts second resolve", async () => {
  let current = true;
  vi.mocked(apiFetch).mockImplementation(async () => Response.json({ code: "PLACE_SESSION_IN_PROGRESS", message: "진행 중" }, { status: 409 }));
  const { args } = setup({ kind: "specific", isCurrent: () => current });
  const pending = confirmPlaceSearch(args);
  await new Promise(r => setTimeout(r, 20)); current = false;
  expect(await pending).toBeNull(); expect(apiFetch).toHaveBeenCalledTimes(1);
});
it("stale resolve cannot overwrite a pre-existing canonical detail", async () => {
  const existing = { ...detail, name: "현재 캐시" };
  client.setQueryData(placeDetailQueryKey("first"), existing);
  let current = true, finish!: (r: Response) => void;
  vi.mocked(apiFetch).mockReturnValue(new Promise(r => { finish = r; }));
  const { args } = setup({ kind: "specific", isCurrent: () => current });
  const pending = confirmPlaceSearch(args); current = false;
  finish(Response.json(response)); expect(await pending).toBeNull();
  expect(client.getQueryData(placeDetailQueryKey("first"))).toBe(existing);
});
