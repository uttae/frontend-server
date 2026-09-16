import { QueryClient } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  client: null as unknown,
  mutation: vi.fn(),
  hydrate: vi.fn(async () => []),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useQueryClient: () => mock.client,
  useMutation: mock.mutation,
}));
vi.mock("@/lib/rooms", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hydrateRoomSchedulesFromServer: mock.hydrate,
  syncRoomDetailFromServer: vi.fn(),
}));
vi.mock("@/lib/plan/scheduleItemPlaces", () => ({
  syncAfterCrossScheduleItemMove: vi.fn(),
  applyScheduleItemDeletedOnClient: vi.fn(),
}));
import {
  useMoveRoomSchedule,
  useDeleteRoomSchedule,
  useDeleteScheduleItem,
  useMoveScheduleItemToSchedule,
  useUpdateRoom,
  useDeleteRoom,
} from "./useRooms";
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient();
  mock.client = client;
  mock.mutation.mockReset();
  mock.hydrate.mockResolvedValue([]);
  for (const suffix of ["list", "summary"])
    client.setQueryData(["room-expenses", "r", suffix], []);
  client.setQueryData(["room-expenses", "other", "list"], []);
});
it.each([
  [
    "day reordering",
    useMoveRoomSchedule,
    { roomId: "r", scheduleId: 1, targetDayNumber: 2 },
  ],
  [
    "day deletion/final clear",
    useDeleteRoomSchedule,
    { roomId: "r", scheduleId: 1 },
  ],
  [
    "place deletion",
    useDeleteScheduleItem,
    { roomId: "r", scheduleId: 1, itemId: 2 },
  ],
  [
    "place move",
    useMoveScheduleItemToSchedule,
    { roomId: "r", sourceScheduleId: 1, targetScheduleId: 2, itemId: 2 },
  ],
  [
    "date shortening",
    useUpdateRoom,
    { roomId: "r", data: { endDate: "2026-09-09" } },
  ],
] as const)(
  "refreshes list and summary after %s",
  async (_, hook, variables) => {
    hook();
    await mock.mutation.mock.lastCall![0].onSuccess({}, variables);
    for (const suffix of ["list", "summary"])
      expect(
        client.getQueryState(["room-expenses", "r", suffix])?.isInvalidated,
      ).toBe(true);
    expect(
      client.getQueryState(["room-expenses", "other", "list"])?.isInvalidated,
    ).toBe(false);
  },
);
it("evicts expenses on room deletion", async () => {
  useDeleteRoom();
  await mock.mutation.mock.lastCall![0].onSuccess(undefined, "r");
  expect(client.getQueryData(["room-expenses", "r", "list"])).toBeUndefined();
  expect(
    client.getQueryData(["room-expenses", "r", "summary"]),
  ).toBeUndefined();
  expect(client.getQueryData(["room-expenses", "other", "list"])).toEqual([]);
});
