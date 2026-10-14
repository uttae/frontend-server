// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  schedules: [{ scheduleId: 10, dayNumber: 1, date: "2026-10-10" }],
  places: [
    { id: "item-101", itemId: 101, title: "첫 장소", location: { lat: 37.5, lng: 127 } },
    { id: "item-102", itemId: 102, title: "먼 장소", location: { lat: 37.7, lng: 127.2 } },
  ],
  expenses: [] as import("@/lib/api/rooms/expenses").Expense[],
  open: vi.fn(),
  openScope: vi.fn(),
  setSelectedPlace: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => fixtures.router }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room-1" }) }));
vi.mock("@/hooks/useRooms", () => ({
  useRoomSchedules: () => ({ data: fixtures.schedules, isSuccess: true }),
  useSchedulePlanPlaces: () => ({ data: fixtures.places, isSuccess: true, isFetching: false }),
}));
vi.mock("@/hooks/usePrefetchScheduleRoutes", () => ({ usePrefetchScheduleRoutes: () => true }));
vi.mock("@/components/expenses/ExpenseProvider", () => ({
  useExpenseContext: () => ({ list: { data: fixtures.expenses }, canManage: true, open: fixtures.open, openScope: fixtures.openScope }),
}));
vi.mock("@/contexts/SelectedPlaceContext", () => ({
  useSelectedPlace: () => ({ setSelectedPlace: fixtures.setSelectedPlace }),
}));
vi.mock("@/components/place/usePlaceDetailData", () => ({ usePlaceDetailData: () => ({}) }));
vi.mock("@/lib/plan/scheduleItemPlaces", () => ({ readSchedulePlanPlacesFromCache: () => fixtures.places }));
vi.mock("@/app/(main)/plan/_components/mobile/useMobileAddPlaceSearch", () => ({
  useMobileAddPlaceSearch: () => ({ recentlyAddedItemId: null, screen: null }),
}));
vi.mock("@/app/(main)/plan/_components/mobile/MobilePlanPlaceSheets", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/app/(main)/plan/_components/mobile/MobilePlanPlaceSheets")>(),
  MobilePlanPlaceSheets: () => null,
}));
vi.mock("@/components/map/MapCloseButton", () => ({ MapCloseButton: () => null }));
vi.mock("./MobileRouteCandidateCard", () => ({ MobileRouteCandidateCard: () => null }));
vi.mock("./MobileRouteCardCarousel", () => ({
  MobileRouteCardCarousel: ({ cards }: { cards: { key: string; node: ReactNode }[] }) => <>{cards.map(card => <section key={card.key}>{card.node}</section>)}</>,
}));
vi.mock("./MobileRoutePlaceDetail", () => ({ MobileRoutePlaceDetail: () => null }));


import { readMapRouteParams } from "@/lib/mobile-view";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { useMobileRouteView } from "./useMobileRouteView";

it.each([
  // 경로 보기 버튼 — 그 일차 첫 장소를 바로 확대한다(일차 전체를 먼저 맞췄다가 확대하지 않는다)
  { url: "/map?view=route&day=1", item: "101" },
  // 일정 카드 — 누른 장소를 확대한다
  { url: "/map?view=route&day=1&item=102", item: "102" },
])("$url 진입 시 처음부터 고른 장소를 확대하고, URL에 선택 장소가 반영돼도 그대로다", async ({ url, item }) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", url);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(scheduleItemsQueryKey("room-1", 10), fixtures.places);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let current: ReturnType<typeof useMobileRouteView> | undefined;
  function Harness() {
    const route = readMapRouteParams(new URLSearchParams(window.location.search));
    const result = useMobileRouteView({ active: route.active, day: route.day, initialItemId: route.itemId });
    useEffect(() => { current = result; });
    return null;
  }
  const render = () => root.render(<QueryClientProvider client={queryClient}><Harness /></QueryClientProvider>);
  try {
    await act(async () => render());
    expect(current?.mapRouteView?.camera.kind).toBe("place");
    expect(new URLSearchParams(window.location.search).get("item")).toBe(item);
    // Next.js reflects native replaceState into useSearchParams; emulate that rerender.
    await act(async () => render());
    expect(current?.mapRouteView?.camera.kind).toBe("place");
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  }
});


import { MobilePlanItinerary } from "@/app/(main)/plan/_components/mobile/MobilePlanItinerary";
import { MobilePlanDragProvider } from "@/app/(main)/plan/_components/mobile/mobilePlanDrag";
vi.mock("@/app/(main)/plan/_components/travel-time/PlanTravelTime", () => ({ PlanTravelTime: () => null }));

it.each([
  { rows: [["KRW", "1000"]], label: "1,000 KRW" },
  { rows: [["JPY", "3600"]], label: "3,600 JPY" },
  { rows: [["USD", "10"], ["USD", "20"], ["KRW", "1000"]], label: "30 USD 외 1건" },
  { rows: [["USD", "10.10"], ["USD", "20.20"]], label: "30.30 USD" },
  { rows: [["JPY", "0"]], label: "0 JPY" },
  { rows: [["USD", "12345678901234567890.12"], ["EUR", "1"]], label: "12,345,678,901,234,567,890.12 USD 외 1건" },
  { rows: [], label: null },
].flatMap(testCase => ["itinerary", "route"].map(mode => ({ ...testCase, mode }))))("$mode shows $label with scoped list/empty-add behavior", async ({ rows, label, mode }) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  fixtures.expenses = rows.map(([currency, totalAmount], id) => ({
    id, version: 1, expenseGroup: "TRIP_DAY", scheduleId: 10, scheduleItemId: 101,
    currency, totalAmount, category: "OTHER", memo: null, name: null,
    payerUserIds: [1], participantUserIds: [1], createdAt: "", updatedAt: "",
  }));
  // Another place must not affect either summary or empty/add decisions.
  fixtures.expenses.push({ id: 100, version: 1, expenseGroup: "TRIP_DAY", scheduleId: 10, scheduleItemId: 102, currency: "KRW", totalAmount: "999999", category: "OTHER", memo: null, name: null, payerUserIds: [1], participantUserIds: [1], createdAt: "", updatedAt: "" });
  fixtures.open.mockClear();
  fixtures.openScope.mockClear();
  window.history.replaceState(null, "", "/map?view=route&day=1&item=101");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(scheduleItemsQueryKey("room-1", 10), fixtures.places);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Route() { return useMobileRouteView({ active: true, day: 1, initialItemId: 101 }).overlay; }
  const drag = { editing: false, dragDisabled: false, pending: null, dropTargetScheduleId: null,
    registerList: vi.fn(), registerRow: vi.fn(), registerPlaces: vi.fn(), startDrag: vi.fn(), rowStyle: () => undefined };
  try {
    await act(async () => root.render(<QueryClientProvider client={queryClient}>
      {mode === "route" ? <Route /> : <MobilePlanDragProvider value={drag}><MobilePlanItinerary roomId="room-1" scheduleId={10} onRequestAddPlace={vi.fn()} recentlyAddedItemId={null} onPlaceAdded={vi.fn()} /></MobilePlanDragProvider>}
    </QueryClientProvider>));
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="첫 장소 비용 ${label ? "보기" : "추가"}"]`);
    if (label) {
      expect(button?.textContent).toContain(label);
      const descriptionId = button?.getAttribute("aria-describedby");
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId!)?.textContent).toBe(label);
      const expenseButtons = [...host.querySelectorAll("button[aria-describedby]")];
      expect(new Set(expenseButtons.map(node => node.getAttribute("aria-describedby"))).size).toBe(expenseButtons.length);
      await act(async () => button!.click());
      expect(fixtures.openScope).toHaveBeenLastCalledWith({ scheduleId: 10, scheduleItemId: 101, label: "첫 장소" });
      expect(fixtures.open).not.toHaveBeenCalled();
    } else if (mode === "route") {
      expect(button).not.toBeNull();
      await act(async () => button!.click());
      expect(fixtures.open).toHaveBeenCalledWith({ scheduleId: 10, scheduleItemId: 101 });
      expect(fixtures.openScope).not.toHaveBeenCalled();
    } else {
      // Itinerary keeps empty expense rows hidden; its action sheet owns adding.
      expect(button).toBeNull();
    }
  } finally {
    await act(async () => root.unmount());
    queryClient.clear(); host.remove(); fixtures.expenses = [];
    if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  }
});
