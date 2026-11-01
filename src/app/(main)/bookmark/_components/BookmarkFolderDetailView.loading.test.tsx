// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BookmarkFolderDetailView } from "./BookmarkFolderDetailView";

const placeQueries = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock("@/hooks/useOpenPlaceOnMap", () => ({ useOpenPlaceOnMap: () => vi.fn() }));
vi.mock("@/stores/session-store", () => ({ useSessionStore: () => "room" }));
vi.mock("@/hooks/useRooms", () => ({
  useAllRoomBookmarks: () => undefined,
  useRoomBookmarks: () => ({ data: [{ bookmarkId: 1, googlePlaceId: "place" }], isPending: false }),
}));
vi.mock("@/lib/places/place-queries", () => ({ placePreviewQueryOptions: () => ({ queryKey: ["place"] }) }));
vi.mock("@tanstack/react-query", () => ({ useQueries: () => placeQueries.current }));
vi.mock("./BookmarkFolderDetailHeader", () => ({ BookmarkFolderDetailHeader: () => null }));
vi.mock("./BookmarkPlaceRow", () => ({ BookmarkPlaceRow: ({ place }: { place: { name: string } }) => <div>{place.name}</div> }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function renderFolder() {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<BookmarkFolderDetailView folder={{ id: "1", title: "여행", color: "red" }} />));
  return { container, unmount: () => act(async () => root.unmount()) };
}

it("keeps cached places visible while their previews refetch", async () => {
  placeQueries.current = [
    { isPending: false, isFetching: true, data: { name: "저장한 장소", googlePlaceId: "place", formattedAddress: "서울" } },
  ];
  const { container, unmount } = await renderFolder();
  try {
    expect(container.textContent).toContain("저장한 장소");
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally {
    await unmount();
  }
});

it("미리보기를 모두 받지 못하면 내부 에러 문구 대신 안내 문구를 보여 준다", async () => {
  placeQueries.current = [
    { isPending: false, isFetching: false, isError: true, error: new Error("batch 응답에 place가 없음") },
  ];
  const { container, unmount } = await renderFolder();
  try {
    expect(container.textContent).toContain("장소 정보를 불러오지 못했습니다.");
    expect(container.textContent).not.toContain("batch 응답에");
  } finally {
    await unmount();
  }
});
