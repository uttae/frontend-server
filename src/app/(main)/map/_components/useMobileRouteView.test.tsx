// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  schedules: [{ scheduleId: 10, dayNumber: 1, date: "2026-10-10" }],
  places: [
    { id: "item-101", itemId: 101, title: "첫 장소", location: { lat: 37.5, lng: 127 } },
    { id: "item-102", itemId: 102, title: "먼 장소", location: { lat: 37.7, lng: 127.2 } },
  ],
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
  useExpenseContext: () => ({ list: { data: [] }, canManage: true }),
}));
vi.mock("@/contexts/SelectedPlaceContext", () => ({
  useSelectedPlace: () => ({ setSelectedPlace: fixtures.setSelectedPlace }),
}));
vi.mock("@/components/place/usePlaceDetailData", () => ({ usePlaceDetailData: () => ({}) }));
vi.mock("@/lib/plan/scheduleItemPlaces", () => ({ readSchedulePlanPlacesFromCache: () => fixtures.places }));
vi.mock("@/app/(main)/plan/_components/mobile/useMobileAddPlaceSearch", () => ({
  useMobileAddPlaceSearch: () => ({ recentlyAddedItemId: null, screen: null }),
}));
vi.mock("@/app/(main)/plan/_components/mobile/MobilePlanPlaceSheets", () => ({
  MobilePlanPlaceSheets: () => null,
  openPlaceExpenses: vi.fn(),
}));
vi.mock("@/components/map/MapCloseButton", () => ({ MapCloseButton: () => null }));
vi.mock("./MobileRouteCandidateCard", () => ({ MobileRouteCandidateCard: () => null }));
vi.mock("./MobileRouteCardCarousel", () => ({ MobileRouteCardCarousel: () => null }));
vi.mock("./MobileRoutePlaceDetail", () => ({ MobileRoutePlaceDetail: () => null }));
vi.mock("./MobileRoutePlaceCard", () => ({
  MobileRouteEmptyDayCard: () => null,
  MobileRouteMessageCard: () => null,
  MobileRoutePlaceCard: () => null,
  MobileRoutePlaceCardSkeleton: () => null,
}));

import { readMapRouteParams } from "@/lib/mobile-view";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { useMobileRouteView } from "./useMobileRouteView";

it.each([
  { url: "/map?view=route&day=1", camera: "fit", item: "101" },
  { url: "/map?view=route&day=1&item=102", camera: "place", item: "102" },
])("$url 진입 시 URL 동기화 후에도 $camera 카메라를 유지한다", async ({ url, camera, item }) => {
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
    expect(current?.mapRouteView?.camera.kind).toBe(camera);
    expect(new URLSearchParams(window.location.search).get("item")).toBe(item);
    // Next.js reflects native replaceState into useSearchParams; emulate that rerender.
    await act(async () => render());
    expect(current?.mapRouteView?.camera.kind).toBe(camera);
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  }
});
