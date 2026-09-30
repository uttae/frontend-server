// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BookmarkFolderDetailView } from "./BookmarkFolderDetailView";

vi.mock("@/hooks/useOpenPlaceOnMap", () => ({ useOpenPlaceOnMap: () => vi.fn() }));
vi.mock("@/stores/session-store", () => ({ useSessionStore: () => "room" }));
vi.mock("@/hooks/useRooms", () => ({
  useAllRoomBookmarks: () => undefined,
  useRoomBookmarks: () => ({ data: [{ bookmarkId: 1, googlePlaceId: "place" }], isPending: false }),
}));
vi.mock("@/lib/places/place-queries", () => ({ placePreviewQueryOptions: () => ({ queryKey: ["place"] }) }));
vi.mock("@tanstack/react-query", () => ({
  useQueries: () => [{ isPending: false, isFetching: true, data: { name: "저장한 장소", googlePlaceId: "place", formattedAddress: "서울" } }],
}));
vi.mock("./BookmarkFolderDetailHeader", () => ({ BookmarkFolderDetailHeader: () => null }));
vi.mock("./BookmarkPlaceRow", () => ({ BookmarkPlaceRow: ({ place }: { place: { name: string } }) => <div>{place.name}</div> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("keeps cached places visible while their previews refetch", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<BookmarkFolderDetailView folder={{ id: "1", title: "여행", color: "red" }} />));
    expect(container.textContent).toContain("저장한 장소");
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
