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

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
const items = () =>
  [...(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].map(
    (item) => item.textContent?.trim(),
  );
const item = (name: string) =>
  [...(menu()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find(
    (candidate) => candidate.textContent?.trim() === name,
  )!;

// 위치 계산(트리거 아래 배치·화면 크기 변경)은 Base UI Positioner가 맡아 픽셀 값은 검사하지 않는다
it("switches to the category phase inside the open menu, closes outside, and reopens on the main phase", async () => {
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
  const trigger = container.querySelector<HTMLElement>(
    'button[aria-label="장소 메뉴"]',
  )!;
  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(items()).toEqual(["카테고리 변경", "삭제"]);

  await act(async () => item("카테고리 변경").click());
  expect(menu()).not.toBeNull();
  expect(items()).toEqual(["뒤로", "two"]);

  await act(async () =>
    document.body.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true }),
    ),
  );
  await flush();
  expect(menu()).toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");

  await act(async () => trigger.click());
  expect(items()).toEqual(["카테고리 변경", "삭제"]);

  await act(async () => root.unmount());
  expect(menu()).toBeNull();
  container.remove();
});
