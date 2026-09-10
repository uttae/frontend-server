// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/plan/room" }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRoomDetail", () => ({ useRoomDetail: () => ({ data: undefined }) }));
vi.mock("@/hooks/useRooms", () => ({
  useRoomsList: () => ({ data: { rooms: [] }, isPending: false }),
  useAllRoomBookmarks: vi.fn(),
  useBookmarkCategories: () => ({ isPending: false, isError: false }),
  useCreateBookmarkCategory: () => ({}),
  useDeleteBookmarkCategory: () => ({}),
  useUpdateBookmarkCategory: () => ({}),
}));
vi.mock("@/stores/session-store", () => ({ useSessionStore: () => "room" }));
vi.mock("@/app/(main)/bookmark/context", () => ({ useBookmarkFolders: () => ({ folders: [] }) }));
vi.mock("@/lib/analytics/track", () => ({ AnalyticsEvents: {}, trackAnalyticsEvent: vi.fn() }));
import HeaderBar from "./HeaderBar";
import { SidebarContactButton } from "./SidebarContactButton";
import { BookmarkFoldersView } from "@/app/(main)/bookmark/_components/BookmarkFoldersView";
import { AddBookmarkModal } from "@/app/(main)/bookmark/_components/AddBookmarkModal";

describe("planning chrome", () => {
  it("uses the transparent blue glyph in the home link", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<HeaderBar />);
    const home = container.querySelector('a[aria-label="홈으로 이동"]');
    expect(home?.getAttribute("href")).toBe("/home");
    expect(home?.querySelector("img")?.getAttribute("src")).toBe("/brand/Glyph_S.svg");
    expect(home?.querySelector("img")?.getAttribute("width")).toBe("23");
    expect(home?.querySelector("img")?.getAttribute("height")).toBe("23");
    expect(home?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });
  it("links directly to the approved bug report form with a consistent label and tooltip", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<SidebarContactButton />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header");
    expect(link?.getAttribute("aria-label")).toBe("버그 제보");
    expect(link?.getAttribute("title")).toBe("버그 제보");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
  it("renders the exported Figma bug asset at its original dimensions", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<SidebarContactButton />);
    const icon = container.querySelector("a img");
    expect(icon?.getAttribute("src")).toBe("/icons/sidebar/bug.svg");
    expect(icon?.getAttribute("width")).toBe("24");
    expect(icon?.getAttribute("height")).toBe("24");
    expect(icon?.getAttribute("alt")).toBe("");
  });
  it("uses the creation label in the bookmark tab and modal", () => {
    const html = renderToStaticMarkup(<BookmarkFoldersView />);
    expect(html).toContain("새 북마크 생성");
    expect(html).not.toContain("새 북마크 추가");
    const modal = renderToStaticMarkup(<AddBookmarkModal mode="create" initialFolder={null} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(modal).toContain("새 북마크 생성");
  });
});
