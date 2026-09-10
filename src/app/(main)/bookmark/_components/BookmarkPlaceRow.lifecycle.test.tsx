// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { BookmarkPlaceRow } from "./BookmarkPlaceRow";
vi.mock("@/hooks/useRooms", () => ({
  useBookmarkCategories: () => ({
    data: [
      { categoryId: 1, name: "one" },
      { categoryId: 2, name: "two" },
    ],
  }),
  useMoveRoomBookmark: () => ({ mutate: vi.fn() }),
  useDeleteRoomBookmarkItem: () => ({ mutate: vi.fn() }),
}));
vi.mock("./BookmarkPlacePreviewCard", () => ({
  BookmarkPlacePreviewCard: () => null,
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("positions the portal at open, updates category phase and closes outside with cleanup", async () => {
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({
      top: 100,
      bottom: 140,
      left: 100,
      right: 300,
      width: 200,
      height: 40,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <BookmarkPlaceRow
        place={{ id: "1", name: "one", address: "서울", googlePlaceId: "one" }}
        roomId="a"
        currentCategoryId={1}
        onOpenDetail={() => {}}
      />,
    ),
  );
  await act(async () => container.querySelector("button")!.click());
  let menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(menu.style.top).toBe("144px");
  await act(async () => menu.querySelector("button")!.click());
  expect(menu.textContent).toContain("two");
  rect.mockReturnValue({
    top: 50,
    bottom: 90,
    left: 100,
    right: 300,
    width: 200,
    height: 40,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
  await act(async () => window.dispatchEvent(new Event("resize")));
  menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(menu.style.top).toBe("94px");
  await act(async () =>
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(document.querySelector('[role="menu"]')).toBeNull();
  await act(async () => root.unmount());
  container.remove();
  rect.mockRestore();
});
