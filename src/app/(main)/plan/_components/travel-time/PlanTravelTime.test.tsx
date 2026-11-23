// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ route: vi.fn(), updateMode: vi.fn() }));
vi.mock("@/lib/api/rooms", async (original) => ({
  ...(await original<object>()),
  getScheduleItemRoute: api.route,
  updateScheduleItemTravelMode: api.updateMode,
}));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));
import { scheduleItemRouteQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import { PlanTravelTime } from "./PlanTravelTime";
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  api.route.mockReset().mockImplementation(async (_r, _s, _i, _d, travelMode) => ({
    travelMode,
    distanceMeters: 100,
    durationSeconds: 60,
  }));
  api.updateMode.mockReset().mockImplementation(async (_r, _s, itemId, body) => ({
    itemId,
    scheduleId: 10,
    googlePlaceId: "a",
    orderIndex: 0,
    startTime: null,
    endTime: null,
    createdAt: "2026-10-28",
    ...body,
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.unstubAllGlobals();
});
// 실제 일정 목록처럼 PATCH 성공 콜백이 갱신한 항목 캐시를 구독한다.
function Itinerary() {
  const { data } = useQuery<{ itemId: number; travelMode?: string }[]>({
    queryKey: scheduleItemsQueryKey("room", 10),
    enabled: false,
  });
  return (
    <PlanTravelTime
      roomId="room"
      scheduleId={10}
      segmentSourceItemId={1}
      destinationItemId={2}
      scheduleFingerprint=""
      travelMode={data?.[0].travelMode}
      originGooglePlaceId="a"
      destinationGooglePlaceId="b"
    />
  );
}

async function render(travelMode?: string) {
  client.setQueryData(scheduleItemsQueryKey("room", 10), [{ itemId: 1, travelMode }]);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Itinerary />
      </QueryClientProvider>,
    ),
  );
}
it.each([undefined, "BICYCLING", "CYCLING", "BOAT"])(
  "does not query or save unsupported %s until an explicit supported selection",
  async (mode) => {
    await render(mode);
    expect(container.textContent).toContain("이동수단 선택");
    expect(container.querySelector("a")).toBeNull();
    expect(api.route).not.toHaveBeenCalled();
    expect(api.updateMode).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    const choice = [...container.querySelectorAll<HTMLButtonElement>("button[role=option]")].find((b) =>
      b.textContent?.includes("자동차"),
    )!;
    await act(async () => choice.click());
    await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 1, 2, "DRIVING"));
    expect(api.updateMode).toHaveBeenCalledExactlyOnceWith("room", 10, 1, { travelMode: "DRIVING" });
  },
);
it.each(["DRIVING", "WALKING", "TRANSIT"])("queries supported %s without saving it", async (mode) => {
  await render(mode);
  await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 1, 2, mode));
  expect(api.updateMode).not.toHaveBeenCalled();
});

it.each(["success", "failure"])(
  "waits for the mode save before requesting a cold walking route (%s)",
  async (outcome) => {
    const save = Promise.withResolvers<{ itemId: number; travelMode: string; googlePlaceId: string }>();
    api.updateMode.mockReturnValue(save.promise);
    api.route.mockImplementation(async (_room, _schedule, _from, _to, travelMode) => ({
      travelMode,
      distanceMeters: travelMode === "WALKING" ? 4228 : 100,
      durationSeconds: 60,
    }));
    await render("DRIVING");
    await vi.waitFor(() => expect(container.textContent).toContain("100m"));
    await act(async () => container.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    const walk = [...container.querySelectorAll<HTMLButtonElement>("button[role=option]")].find((option) =>
      option.textContent?.includes("도보"),
    )!;
    await act(async () => walk.click());
    await vi.waitFor(() => expect(container.querySelector("a")?.href).toContain("travelmode=walking"));
    expect(api.updateMode).toHaveBeenCalledExactlyOnceWith("room", 10, 1, { travelMode: "WALKING" });
    expect(api.route.mock.calls.map((call) => call[4])).toEqual(["DRIVING"]);

    if (outcome === "success") {
      await act(async () => save.resolve({ itemId: 1, googlePlaceId: "a", travelMode: "WALKING" }));
      await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 1, 2, "WALKING"));
      await vi.waitFor(() => expect(container.textContent).toContain("4.2km"));
      expect(api.route.mock.calls.map((call) => call[4])).toEqual(["DRIVING", "WALKING"]);
    } else {
      await act(async () => save.reject(new Error("save failed")));
      await vi.waitFor(() => expect(container.querySelector("a")?.href).toContain("travelmode=driving"));
      expect(container.textContent).toContain("100m");
      expect(api.route.mock.calls.map((call) => call[4])).toEqual(["DRIVING"]);
    }
  },
);

it.each([false, true])("queries only saved legs after walking failures (overlapping C save: %s)", async (saveC) => {
  const places = [
    { itemId: 101, travelMode: "WALKING" },
    { itemId: 103, travelMode: "WALKING" },
  ];
  if (saveC) places.push({ itemId: 105, travelMode: "WALKING" });
  const savedItem = { itemId: 101, googlePlaceId: "a", travelMode: "DRIVING" };
  const save = Promise.withResolvers<typeof savedItem>();
  const savedC = { itemId: 105, googlePlaceId: "c", travelMode: "DRIVING" };
  const otherSave = Promise.withResolvers<typeof savedC>();
  api.updateMode.mockImplementation((_room, _day, id) => (id === 105 ? otherSave.promise : save.promise));
  api.route.mockImplementation(async (_room, _schedule, _from, _to, mode) => {
    if (mode === "WALKING") throw new Error("route unavailable");
    return { travelMode: mode, distanceMeters: 100, durationSeconds: 60 };
  });
  const otherPlaces = saveC ? [places[1], savedC] : [places[1]];
  const fetchDay = vi.fn(async () => [savedItem, ...otherPlaces]);
  function DayRoutes() {
    const { data, isFetching } = useQuery({
      queryKey: scheduleItemsQueryKey("room", 10),
      queryFn: fetchDay,
      initialData: places,
      staleTime: Infinity,
    });
    return data.map(({ itemId, travelMode }) => (
      <PlanTravelTime
        key={itemId}
        roomId="room"
        scheduleId={10}
        segmentSourceItemId={itemId}
        destinationItemId={itemId + 1}
        travelMode={travelMode}
        scheduleFingerprint=""
        routeQueryEnabled={!isFetching}
      />
    ));
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <DayRoutes />
      </QueryClientProvider>,
    ),
  );
  const walkingCalls = [
    ["room", 10, 101, 102, "WALKING"],
    ["room", 10, 103, 104, "WALKING"],
  ];
  if (saveC) walkingCalls.push(["room", 10, 105, 106, "WALKING"]);
  await vi.waitFor(() => expect(container.textContent?.match(/경로 조회 오류/g)).toHaveLength(places.length));
  expect(api.route.mock.calls).toEqual(walkingCalls);
  const chooseDriving = async (index: number) => {
    await act(async () => container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")[index].click());
    const driving = [...container.querySelectorAll<HTMLButtonElement>("button[role=option]")].find((option) =>
      option.textContent?.includes("자동차"),
    )!;
    await act(async () => driving.click());
  };
  await chooseDriving(0);
  await vi.waitFor(() =>
    expect(api.updateMode).toHaveBeenCalledExactlyOnceWith("room", 10, 101, { travelMode: "DRIVING" }),
  );
  const expectedCalls = [...walkingCalls];
  if (saveC) {
    await chooseDriving(2);
    expect(api.updateMode).toHaveBeenNthCalledWith(2, "room", 10, 105, { travelMode: "DRIVING" });
    expect(api.route.mock.calls).toEqual(walkingCalls);
    await act(async () => otherSave.resolve(savedC));
    expectedCalls.push(["room", 10, 105, 106, "DRIVING"]);
    await vi.waitFor(() => expect(api.route.mock.calls).toEqual(expectedCalls));
  }
  expect(api.route.mock.calls).toEqual(expectedCalls);
  await act(async () => save.resolve(savedItem));
  await vi.waitFor(() => expect(api.route.mock.calls).toEqual([...expectedCalls, ["room", 10, 101, 102, "DRIVING"]]));
  expect(fetchDay).not.toHaveBeenCalled();

  api.route.mockClear();
  await act(async () => {
    await client.refetchQueries({ queryKey: scheduleItemRouteQueryKey("room", 10, 103, 104, "WALKING"), exact: true });
  });
  expect(api.route.mock.calls).toEqual([walkingCalls[1]]);

  fetchDay.mockResolvedValueOnce([{ ...savedItem, travelMode: "TRANSIT" }, ...otherPlaces]);
  await act(async () => {
    await client.invalidateQueries({ queryKey: scheduleItemsQueryKey("room", 10), exact: true });
  });
  await vi.waitFor(() => expect(api.route).toHaveBeenCalledWith("room", 10, 101, 102, "TRANSIT"));
});

it.each([
  { firstOk: true, lastOk: true, final: "TRANSIT" },
  { firstOk: true, lastOk: false, final: "WALKING" },
  { firstOk: false, lastOk: true, final: "TRANSIT" },
  { firstOk: false, lastOk: false, final: "DRIVING" },
])(
  "serializes two choices and displays the last confirmed route ($firstOk, $lastOk)",
  async ({ firstOk, lastOk, final }) => {
    type Item = { itemId: number; googlePlaceId: string; travelMode: string };
    const walk = Promise.withResolvers<Item>();
    const transit = Promise.withResolvers<Item>();
    api.updateMode.mockReturnValueOnce(walk.promise).mockReturnValueOnce(transit.promise);
    const calls = () => api.route.mock.calls.map((call) => call[4]);
    const choose = async (label: string) => {
      await act(async () => container.querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
      const option = [...container.querySelectorAll<HTMLButtonElement>("button[role=option]")].find((button) =>
        button.textContent?.includes(label),
      )!;
      await act(async () => option.click());
    };
    await render("DRIVING");
    await vi.waitFor(() => expect(calls()).toEqual(["DRIVING"]));
    await choose("도보");
    await choose("대중교통");
    await vi.waitFor(() => expect(container.querySelector("a")?.href).toContain("travelmode=transit"));
    expect(api.updateMode).toHaveBeenCalledExactlyOnceWith("room", 10, 1, { travelMode: "WALKING" });
    expect(calls()).toEqual(["DRIVING"]);
    await act(async () => {
      if (firstOk) walk.resolve({ itemId: 1, googlePlaceId: "a", travelMode: "WALKING" });
      else walk.reject(new Error("walking save failed"));
    });
    await vi.waitFor(() => expect(api.updateMode).toHaveBeenNthCalledWith(2, "room", 10, 1, { travelMode: "TRANSIT" }));
    expect(calls()).toEqual(["DRIVING"]);
    expect(container.querySelector("a")?.href).toContain("travelmode=transit");
    await act(async () => {
      if (lastOk) transit.resolve({ itemId: 1, googlePlaceId: "a", travelMode: "TRANSIT" });
      else transit.reject(new Error("transit save failed"));
    });
    await vi.waitFor(() => {
      expect(client.getQueryData<Item[]>(scheduleItemsQueryKey("room", 10))?.[0].travelMode).toBe(final);
      expect(container.querySelector("a")?.href).toContain("travelmode=" + final.toLowerCase());
      expect(calls()).toEqual(final === "DRIVING" ? ["DRIVING"] : ["DRIVING", final]);
    });
  },
);
