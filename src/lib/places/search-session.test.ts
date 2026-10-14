import { describe, expect, it, vi } from "vitest";
import {
  confirmPlaceSearch,
  terminatePredictionSession,
} from "./search-session";

function prediction(id = "first", location = { lat: 37, lng: 127 }) {
  const fetchFields = vi.fn().mockResolvedValue(undefined);
  const place = {
    fetchFields,
    location: { lat: () => location.lat, lng: () => location.lng },
  };
  return {
    placeId: id,
    mainText: { text: "추천 이름" },
    secondaryText: { text: "주소" },
    toPlace: vi.fn(() => place),
    fetchFields,
  };
}
function setup(overrides = {}) {
  const p = prediction();
  const search = vi.fn().mockResolvedValue([{ googlePlaceId: "other" }]);
  const args = {
    query: "원래 검색어",
    kind: "whole" as const,
    prediction: p as unknown as google.maps.places.PlacePrediction,
    session: {},
    mapCenter: { lat: 1, lng: 2 },
    isCurrent: () => true,
    search,
    ...overrides,
  };
  return { args, p, search };
}
describe("session-connected search", () => {
  it("actually terminates once with location only, returning partial coordinates", async () => {
    const p = prediction();
    const session = {};
    const a = terminatePredictionSession(
      p as unknown as google.maps.places.PlacePrediction,
      session,
    );
    const b = terminatePredictionSession(
      p as unknown as google.maps.places.PlacePrediction,
      session,
    );
    expect(await a).toEqual({
      kind: "coordinates",
      googlePlaceId: "first",
      location: { lat: 37, lng: 127 },
      termination: "completed",
    });
    await b;
    expect(p.toPlace).toHaveBeenCalledTimes(1);
    expect(p.fetchFields).toHaveBeenCalledExactlyOnceWith({
      fields: ["location"],
    });
  });
  it("searches original query within 5km around FIRST prediction, preserves it absent from results", async () => {
    const { args, p, search } = setup();
    const result = await confirmPlaceSearch(args);
    expect(search).toHaveBeenCalledExactlyOnceWith({
      query: "원래 검색어",
      latitude: 37,
      longitude: 127,
      radius: 5000,
    });
    expect(result?.anchor?.googlePlaceId).toBe(p.placeId);
    expect(result?.items).toEqual([{ googlePlaceId: "other" }]);
    expect(result?.fallback).toBe(false);
  });
  it("specific prediction makes zero Text Search calls", async () => {
    const { args, search } = setup({ kind: "specific" });
    expect((await confirmPlaceSearch(args))?.anchor?.googlePlaceId).toBe(
      "first",
    );
    expect(search).not.toHaveBeenCalled();
  });
  it.each(["absent", "failed"])(
    "falls back to map center for %s first prediction without trying another",
    async (mode) => {
      const { args, p, search } = setup(
        mode === "absent" ? { prediction: undefined } : {},
      );
      if (mode === "failed")
        p.fetchFields.mockRejectedValue(new Error("details failed"));
      expect((await confirmPlaceSearch(args))?.fallback).toBe(true);
      expect(search).toHaveBeenCalledExactlyOnceWith({
        query: "원래 검색어",
        latitude: 1,
        longitude: 2,
        radius: 5000,
      });
    },
  );
  it("rejects no-center fallback and blank input without outbound calls", async () => {
    const { args, search } = setup({ prediction: undefined, mapCenter: null });
    await expect(confirmPlaceSearch(args)).rejects.toThrow("지도 위치");
    await expect(confirmPlaceSearch({ ...args, query: "  " })).rejects.toThrow(
      "검색어",
    );
    expect(search).not.toHaveBeenCalled();
  });
  it("suppresses late Details and does not start search", async () => {
    let finish!: () => void;
    let current = true;
    const { args, p, search } = setup({ isCurrent: () => current });
    p.fetchFields.mockImplementation(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    const pending = confirmPlaceSearch(args);
    current = false;
    finish();
    expect(await pending).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });
  it("suppresses late Text Search", async () => {
    let finish!: (items: unknown[]) => void;
    let current = true;
    const { args, search } = setup({ isCurrent: () => current });
    search.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    const pending = confirmPlaceSearch(args);
    await vi.waitFor(() => expect(search).toHaveBeenCalled());
    current = false;
    finish([]);
    expect(await pending).toBeNull();
  });
  it("invalid coordinates cannot become a complete detail or a completed termination", async () => {
    const p = prediction("bad", { lat: NaN, lng: 2 });
    await expect(
      terminatePredictionSession(
        p as unknown as google.maps.places.PlacePrediction,
        {},
      ),
    ).rejects.toThrow("좌표");
  });
});

it("a consumed session cannot confirm a different prediction identity", async () => {
  const session = {};
  const first = prediction("first");
  const other = prediction("other");
  await terminatePredictionSession(
    first as unknown as google.maps.places.PlacePrediction,
    session,
  );
  await expect(
    terminatePredictionSession(
      other as unknown as google.maps.places.PlacePrediction,
      session,
    ),
  ).rejects.toThrow("이미");
  expect(other.toPlace).not.toHaveBeenCalled();
});
