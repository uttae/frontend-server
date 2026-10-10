import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { MobileRoutePlaceDetail } from "./MobileRoutePlaceDetail";

const state = vi.hoisted(() => ({ roomId: undefined as string | undefined, loading: true, track: vi.fn() }));
vi.mock("@/hooks/useAnalyticsRoomId", () => ({ useAnalyticsRoomId: () => state.roomId }));
vi.mock("@/components/place/usePlaceDetailData", () => ({ usePlaceDetailData: () => ({ isLoading: state.loading }) }));
vi.mock("@/components/place/HeroSection", () => ({ HeroImage: () => null, HeroSkeleton: () => null }));
vi.mock("@/components/place/PlaceDetailTabs", () => ({ PlaceDetailTabs: () => null }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: { viewPlace: "view_place" }, trackAnalyticsEvent: state.track }));
let renderer: ReactTestRenderer;
afterEach(async () => { await act(async () => renderer?.unmount()); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it.each(["room-a", undefined])("groups only confirmed room %s once when an active route detail is loaded", async roomId => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.roomId = roomId;
  state.loading = true;
  const view = (active: boolean, id = "place-a") => <MobileRoutePlaceDetail
    place={{ googlePlaceId: id, title: "장소", primaryTypeDisplayName: "식당" }} active={active} analyticsSource="map" />;
  await act(async () => { renderer = create(view(false)); });
  await act(async () => renderer.update(view(true)));
  expect(state.track).not.toHaveBeenCalled();
  state.loading = false;
  await act(async () => renderer.update(view(true)));
  expect(state.track).toHaveBeenCalledExactlyOnceWith("view_place", {
    place_category: "식당", interaction_source: "map", ...(roomId ? { room_id: roomId } : {}),
  });
  await act(async () => renderer.update(view(false)));
  await act(async () => renderer.update(view(true)));
  expect(state.track).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(view(true, "place-b")));
  expect(state.track).toHaveBeenCalledTimes(2);
});
