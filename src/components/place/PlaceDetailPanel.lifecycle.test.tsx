// @vitest-environment jsdom
import { act, useLayoutEffect, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  SelectedPlaceProvider,
  useSelectedPlace,
} from "@/contexts/SelectedPlaceContext";
import { PlaceDetailPanel } from "./PlaceDetailPanel";
import type { PlaceSummaryHeader } from "./PlaceSummaryHeader";
const state = vi.hoisted(() => ({
  roomId: "room-a" as string | undefined,
  track: vi.fn(),
  header: null as ComponentProps<typeof PlaceSummaryHeader> | null,
  source: "",
  failure: false,
  retry: vi.fn(),
}));
vi.mock("@/hooks/useAnalyticsRoomId", () => ({ useAnalyticsRoomId: () => state.roomId }));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { viewPlace: "view_place" },
  trackAnalyticsEvent: state.track,
}));
vi.mock("@/hooks/useChat", () => ({ useChat: () => ({ openChat: vi.fn() }) }));
vi.mock("@/hooks/useChatActions", () => ({
  useChatActions: () => ({ canSend: false }),
}));
vi.mock("./usePlaceDetailData", () => ({
  usePlaceDetailData: () => ({ isLoading: false, isError: state.failure, refetch: state.retry }),
}));
vi.mock("./HeroSection", () => ({
  HeroImage: () => null,
  HeroSkeleton: () => null,
}));
vi.mock("./HomeTab", () => ({ HomeTab: () => null }));
vi.mock("./ReviewsTab", () => ({ ReviewsTab: () => <div data-reviews /> }));
vi.mock("./PlaceSummaryHeader", () => ({
  PlaceSummaryHeader: (props: ComponentProps<typeof PlaceSummaryHeader>) => {
    state.header = props;
    return null;
  },
}));
vi.mock("./AddToScheduleModal", () => ({
  AddToScheduleModal: ({ source }: { source: string }) => {
    state.source = source;
    return null;
  },
}));
vi.mock("./AddToBookmarkModal", () => ({ AddToBookmarkModal: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("keeps the current entry source for schedule addition and emits one view per mounted place", async () => {
  const root = createRoot(document.createElement("div"));
  let selection!: ReturnType<typeof useSelectedPlace>;
  function Probe() {
    const current = useSelectedPlace();
    useLayoutEffect(() => {
      selection = current;
    });
    return current.selectedPlace ? (
      <PlaceDetailPanel
        {...current.selectedPlace}
        onClose={() => current.setSelectedPlace(null)}
      />
    ) : null;
  }
  await act(async () =>
    root.render(
      <SelectedPlaceProvider>
        <Probe />
      </SelectedPlaceProvider>,
    ),
  );
  const place = {
    googlePlaceId: "fixture-1",
    name: "fixture",
    category: "cafe",
    rating: 4.5,
  };
  await act(async () =>
    selection.setSelectedPlace(place, { itinerarySource: "search" }),
  );
  expect(state.track).toHaveBeenCalledTimes(1);
  expect(state.track.mock.lastCall?.[1].room_id).toBe("room-a");
  expect(state.track.mock.lastCall?.[1].interaction_source).toBe("search");
  await act(async () =>
    selection.setSelectedPlace(place, { itinerarySource: "bookmark" }),
  );
  await act(async () => state.header!.onAddToSchedule?.());
  expect(state.source).toBe("bookmark");
  expect(state.track).toHaveBeenCalledTimes(1);
  await act(async () => selection.setSelectedPlace(null));
  await act(async () =>
    selection.setSelectedPlace(place, { itinerarySource: "chat" }),
  );
  expect(state.track).toHaveBeenCalledTimes(2);
  expect(state.track.mock.lastCall?.[1].interaction_source).toBe("chat");
  for (const source of ["map", "plan"] as const) {
    await act(async () => selection.setSelectedPlace(null));
    const count = state.track.mock.calls.length;
    await act(async () => selection.setSelectedPlace(place, { itinerarySource: source }));
    await act(async () => state.header!.onAddToSchedule?.());
    expect(state.source).toBe(source);
    expect(state.track).toHaveBeenCalledTimes(count + 1);
    expect(state.track.mock.lastCall?.[1].interaction_source).toBe(source);
  }
  await act(async () => root.unmount());
});

it("full-detail failure shows retry without no-review content or a successful view", async () => {
  state.failure = true; state.track.mockClear(); state.retry.mockClear();
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => root.render(<PlaceDetailPanel name="장소" category="" rating={null} googlePlaceId="failed" onClose={() => {}} />));
  expect(host.querySelector("[data-reviews]")).toBeNull();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(state.track).not.toHaveBeenCalled();
  const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "다시 시도");
  await act(async () => retry!.click()); expect(state.retry).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount()); state.failure = false;
});
