// @vitest-environment jsdom
import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bookmarkCategoriesQueryKey, roomSchedulesQueryKey, scheduleItemsQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { AddToBookmarkModal } from "./AddToBookmarkModal";
import { AddToScheduleModal } from "./AddToScheduleModal";
import { PlanPlaceCard } from "@/app/(main)/plan/_components/itinerary/PlanPlaceCard";
import { useMobileAddPlaceSearch } from "@/app/(main)/plan/_components/mobile/useMobileAddPlaceSearch";
import { MobilePlanPlaceSheets } from "@/app/(main)/plan/_components/mobile/MobilePlanPlaceSheets";

vi.mock("@/lib/client-env", () => ({ clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test", NEXT_PUBLIC_GOOGLE_REDIRECT_URI: "https://example.test", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test" } }));
const api = vi.hoisted(() => ({ bookmarks: vi.fn(), category: vi.fn(), item: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/api/rooms", async (original) => ({
  ...await original<object>(), createRoomBookmarks: api.bookmarks, createBookmarkCategory: api.category, deleteScheduleItem: api.remove,
}));
vi.mock("@/components/expenses/ExpenseProvider", () => ({ ExpenseEntryButton: () => null, useExpenseContext: () => ({}) }));
vi.mock("@/hooks/useOpenPlaceOnMap", () => ({ useOpenPlaceOnMap: () => vi.fn() }));
vi.mock("@/hooks/useInViewport", () => ({ useInViewport: () => [() => {}, false] }));
vi.mock("@/hooks/usePlanPlaceCardPhoto", () => ({ usePlanPlaceCardPhoto: () => ({ resolvedPhotoUrl: null, photoLoading: false }) }));
vi.mock("@/lib/api/rooms/schedule-items", async (original) => ({
  ...await original<object>(), createScheduleItem: api.item,
}));
vi.mock("@/lib/places/place-queries", async (original) => ({
  ...await original<object>(), fetchPlacePreview: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { addToBookmark: "add_to_bookmark", createBookmarkFolder: "create_bookmark_folder", addToItinerary: "add_to_itinerary", removeFromItinerary: "remove_from_itinerary" },
  trackAnalyticsEvent: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let client: QueryClient;
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ currentRoomId: "room-a" });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const room of ["room-a", "room-b"]) {
    client.setQueryData(bookmarkCategoriesQueryKey(room), [{ categoryId: 7, name: "Food", colorCode: "#EAB308", placeCount: 0 }]);
    client.setQueryData(roomSchedulesQueryKey(room), [{ scheduleId: 1, dayNumber: 1, date: "2026-10-10" }]);
    client.setQueryData(scheduleItemsQueryKey(room, 1), []);
  }
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); client.clear(); });
async function render(node: ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}
async function click(label: string) {
  const button = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
}
async function finish(action: () => void) {
  await act(async () => { action(); await new Promise((resolve) => setTimeout(resolve, 10)); });
}

it("keeps the bookmark write's room after the selected room changes before the API resolves", async () => {
  const pending = deferred<unknown[]>();
  api.bookmarks.mockReturnValueOnce(pending.promise);
  await render(<AddToBookmarkModal googlePlaceId="place" onClose={() => {}} />);
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Food 북마크에서 선택"]')!.click());
  await click("추가");
  expect(api.bookmarks).toHaveBeenCalledWith("room-a", { googlePlaceId: "place", categoryIds: [7] });
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  await act(async () => useSessionStore.setState({ currentRoomId: "room-b" }));
  await finish(() => pending.resolve([{ bookmarkId: 8, categoryId: 7, googlePlaceId: "place", createdAt: "2026-10-10" }]));
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("add_to_bookmark", expect.objectContaining({ room_id: "room-a" }));
});

it("keeps the created folder's request room after switching rooms", async () => {
  const pending = deferred<object>();
  api.category.mockReturnValueOnce(pending.promise);
  await render(<AddToBookmarkModal googlePlaceId="place" onClose={() => {}} />);
  await click("새 북마크 만들기");
  await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(api.category).toHaveBeenCalledWith("room-a", expect.any(Object));
  await act(async () => useSessionStore.setState({ currentRoomId: "room-b" }));
  await finish(() => pending.resolve({ categoryId: 9, name: "New", colorCode: "#EAB308", placeCount: 0 }));
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("create_bookmark_folder", { room_id: "room-a" });
});

it.each(["duplicate", "error"])("does not count a %s bookmark response", async (result) => {
  if (result === "duplicate") api.bookmarks.mockResolvedValueOnce([]);
  else api.bookmarks.mockRejectedValueOnce(new Error("network"));
  await render(<AddToBookmarkModal googlePlaceId="place" onClose={() => {}} />);
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Food 북마크에서 선택"]')!.click());
  await click("추가");
  await finish(() => {});
  expect(api.bookmarks).toHaveBeenCalledTimes(1);
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
});

it("keeps an itinerary addition tied to its API room after switching rooms", async () => {
  const pending = deferred<object>();
  api.item.mockReturnValueOnce(pending.promise);
  await render(<AddToScheduleModal googlePlaceId="place" onClose={() => {}} />);
  const day = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("1일차"))!;
  await act(async () => day.click());
  expect(api.item).toHaveBeenCalledWith("room-a", 1, { googlePlaceId: "place", orderIndex: 0 });
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  await act(async () => useSessionStore.setState({ currentRoomId: "room-b" }));
  await finish(() => pending.resolve({ createdItem: { itemId: 2, scheduleId: 1, googlePlaceId: "place", startTime: null, endTime: null, orderIndex: 0, travelMode: "DRIVING", createdAt: "2026-10-10" }, updatedItems: [], affectedRouteItemIds: [] }));
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("add_to_itinerary", expect.objectContaining({ room_id: "room-a" }));
});

it("does not count a rejected itinerary addition", async () => {
  api.item.mockRejectedValueOnce(new Error("network"));
  await render(<AddToScheduleModal googlePlaceId="place" onClose={() => {}} />);
  const day = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("1일차"))!;
  await act(async () => day.click());
  await finish(() => {});
  expect(api.item).toHaveBeenCalledTimes(1);
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
});

it("keeps a deletion tied to the card's original room when props change during the API call", async () => {
  const pending = deferred<void>();
  api.remove.mockReturnValueOnce(pending.promise);
  const card = (roomId: string) => <PlanPlaceCard
    place={{ id: "item-2", itemId: 2, title: "Place" }}
    itineraryItemCount={1} displayOrderIndex={1} isDragging={false}
    scheduleTimeEdit={{ roomId, scheduleId: 1 }} onDragStart={() => {}} onDragEnd={() => {}}
  />;
  await render(card("room-a"));
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="일정에서 삭제"]')!.click());
  await click("삭제");
  expect(api.remove).toHaveBeenCalledWith("room-a", 1, 2);
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  await render(card("room-b"));
  await finish(() => pending.resolve());
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("remove_from_itinerary", expect.objectContaining({ room_id: "room-a" }));
});

it("keeps the shared mobile add hook's request room after rerendering for a new room", async () => {
  const pending = deferred<object>();
  api.item.mockReturnValueOnce(pending.promise);
  let add!: ReturnType<typeof useMobileAddPlaceSearch>;
  function Probe({ roomId }: { roomId: string }) {
    const value = useMobileAddPlaceSearch({ roomId, backLabel: "돌아가기" });
    useLayoutEffect(() => { add = value; }, [value]);
    return null;
  }
  await render(<Probe roomId="room-a" />);
  let saving!: Promise<number | null>;
  await act(async () => { saving = add.addAt({ scheduleId: 1, anchor: null }, "place", "map"); });
  expect(api.item).toHaveBeenCalledWith("room-a", 1, expect.anything());
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  await render(<Probe roomId="room-b" />);
  await finish(() => pending.resolve({ createdItem: { itemId: 21, scheduleId: 1, googlePlaceId: "place", startTime: null, endTime: null, orderIndex: 0, travelMode: "DRIVING", createdAt: "2026-10-10" }, updatedItems: [], affectedRouteItemIds: [] }));
  await expect(saving).resolves.toBe(21);
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("add_to_itinerary", {
    room_id: "room-a", interaction_source: "map", item_count_bucket: "1",
  });
});

it("keeps the extracted mobile delete sheet's room after its pending request completes", async () => {
  const pending = deferred<void>();
  api.remove.mockReturnValueOnce(pending.promise);
  const place = { id: "p", itemId: 22, title: "장소", location: { lat: 1, lng: 2 } };
  const sheet = (roomId: string) => <MobilePlanPlaceSheets roomId={roomId} scheduleId={1}
    places={[place]} monthDayLabel="10/10" sheet={{ kind: "delete", place }}
    onChangeSheet={() => {}} canInsert onInsertFromSearch={() => {}} onPlaceAdded={() => {}} />;
  await render(sheet("room-a"));
  await click("삭제");
  expect(api.remove).toHaveBeenCalledWith("room-a", 1, 22);
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  await render(sheet("room-b"));
  await finish(() => pending.resolve());
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("remove_from_itinerary", {
    room_id: "room-a", item_count_bucket: "0",
  });
});
