import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture.test" }));
let api: typeof import("./schedule-items");
beforeAll(async () => {
  api = await import("./schedule-items");
});
beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(
    new Response(JSON.stringify({ startTime: "23:00", endTime: "01:00" })),
  );
});
describe("schedule time JSON contract", () => {
  it.each([
    { endTime: "01:00" },
    { endTime: null },
    { startTime: null, endTime: null },
    { memo: "memo" },
    { startTime: "00:00", endTime: "00:00" },
  ])("preserves PATCH field presence and null: %o", async (body) => {
    await api.updateScheduleItem("room", 10, 1, body);
    expect(apiFetch.mock.calls[0][0]).toBe(
      "http://fixture.test/rooms/room/schedules/10/items/1",
    );
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual(body);
  });
  it.each([
    { googlePlaceId: "place", startTime: "23:00", endTime: "01:00" },
    { googlePlaceId: "place", startTime: null, endTime: null },
    { googlePlaceId: "place" },
  ])("creates canonical nullable times: %o", async (body) => {
    await api.createScheduleItem("room", 10, body);
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual(body);
  });
  it("reads endTime unchanged through list, reorder, move and travel mode responses", async () => {
    const item = { startTime: "23:00", endTime: "01:00" };
    apiFetch.mockImplementation(
      async () => new Response(JSON.stringify([item])),
    );
    expect(await api.getScheduleItems("room", 10)).toEqual([item]);
    expect(
      await api.reorderScheduleItem("room", 10, 1, { newOrderIndex: 1 }),
    ).toEqual([item]);
    apiFetch.mockImplementation(async () => new Response(JSON.stringify(item)));
    expect(
      await api.moveScheduleItemToSchedule("room", 10, 1, {
        targetScheduleId: 11,
        targetOrderIndex: 0,
      }),
    ).toEqual(item);
    expect(
      await api.updateScheduleItemTravelMode("room", 10, 1, {
        travelMode: "WALKING",
      }),
    ).toEqual(item);
  });
  it("keeps route durationSeconds", async () => {
    apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          durationSeconds: 1200,
          distanceMeters: 500,
          travelMode: "WALKING",
        }),
      ),
    );
    expect(await api.getScheduleItemRoute("room", 10, 1)).toMatchObject({
      durationSeconds: 1200,
    });
  });
});
