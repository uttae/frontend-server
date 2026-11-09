// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { PlanItemDragProvider, type PlanItemDragValue } from "@/hooks/usePlanItemDragController";
import type { PlanPlace } from "@/lib/plan/types";

import { PlanItinerary } from "./PlanItinerary";

const fixtures = vi.hoisted(() => ({
  places: [] as PlanPlace[],
  savingDays: [] as number[],
  travel: [] as { segmentSourceItemId: number; routeQueryEnabled?: boolean }[],
}));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({ data: fixtures.places, isLoading: false, isFetching: false, isError: false }),
  useCreateScheduleItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useScheduleItemMoveSavingDays: () => fixtures.savingDays,
}));
vi.mock("@/hooks/usePrefetchScheduleRoutes", () => ({ usePrefetchScheduleRoutes: () => true }));
vi.mock("../travel-time/PlanTravelTime", () => ({
  PlanTravelTime: (props: { segmentSourceItemId: number; routeQueryEnabled?: boolean }) => {
    fixtures.travel.push(props);
    return null;
  },
}));
vi.mock("./PlanPlaceCard", () => ({ PlanPlaceCard: () => null }));
vi.mock("./PlanAddPlaceControls", () => ({ PlanAddPlaceControls: () => null }));
vi.mock("./AddFromBookmarkModal", () => ({ AddFromBookmarkModal: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const drag: PlanItemDragValue = {
  getListProps: () => ({
    dropZoneProps: { "data-plan-itinerary-drop-zone": "", onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} },
    isItemDragActive: false,
    reservePaddingBottom: 0,
    getRowProps: () => ({
      ref: () => {},
      style: undefined,
      placeCardDragProps: { displayOrderIndex: 1, isDragging: false, dragDisabled: false, onDragStart: () => {}, onDragEnd: () => {} },
    }),
  }),
  getSectionDrop: () => ({ props: { onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} }, isTarget: false }),
};

const place = (itemId: number): PlanPlace => ({ id: `item-${itemId}`, itemId, googlePlaceId: `g${itemId}`, title: `장소 ${itemId}` });

it("does not query segment routes of a day while its place move is saving — the server still has the old order", async () => {
  fixtures.places = [place(2), place(1)];
  const host = document.createElement("div");
  const root = createRoot(host);
  const render = () =>
    act(async () => {
      root.render(
        <PlanItemDragProvider value={drag}>
          <PlanItinerary roomId="room-1" scheduleId={10} />
        </PlanItemDragProvider>,
      );
    });
  try {
    // 순서 변경을 저장하는 중 — 캐시는 이미 새 순서(2 → 1)다
    fixtures.savingDays = [10];
    fixtures.travel = [];
    await render();
    expect(fixtures.travel.at(-1)).toMatchObject({ segmentSourceItemId: 2, routeQueryEnabled: false });

    // 다른 일차를 저장하는 중이면 이 일차는 조회한다
    fixtures.savingDays = [20];
    await render();
    expect(fixtures.travel.at(-1)).toMatchObject({ segmentSourceItemId: 2, routeQueryEnabled: true });

    // 저장이 끝나면 조회한다
    fixtures.savingDays = [];
    await render();
    expect(fixtures.travel.at(-1)).toMatchObject({ segmentSourceItemId: 2, routeQueryEnabled: true });
  } finally {
    await act(async () => root.unmount());
  }
});
