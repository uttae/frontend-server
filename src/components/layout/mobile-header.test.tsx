// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mobile: true, pathname: "/plan/room" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRoomDetail", () => ({ useRoomDetail: () => ({ data: undefined }) }));
vi.mock("@/hooks/useRooms", () => ({ useRoomsList: () => ({ data: { rooms: [{ id: "room", title: "가을 여행", startDate: "2026-10-10", endDate: "2026-10-12" }] }, isPending: false }) }));
vi.mock("@/components/rooms/RoomTripEditDialog", () => ({ RoomTripEditDialog: () => <div role="dialog">정보 수정</div> }));
vi.mock("@/hooks/useSessionPromptVisible", () => ({ useSessionPromptVisible: () => ({ visible: false, dismiss: vi.fn() }) }));
import HeaderBar from "./HeaderBar";
import { BookmarkFolderDetailHeader } from "@/app/(main)/bookmark/_components/BookmarkFolderDetailHeader";

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.mobile = true;
  state.pathname = "/plan/room";
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<HeaderBar />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function rerender() { await act(async () => root.render(<HeaderBar />)); }

it("shows the room details and map action in the mobile top navigation", () => {
  expect(host.querySelector("header")?.textContent).toContain("가을 여행");
  expect(host.querySelector("header")?.textContent).toContain("26/10/10 - 26/10/12");
  expect(host.querySelector('a[aria-label="지도 보기"]')?.getAttribute("href")).toBe("/plan/room?view=map");
  expect(host.querySelector('a[aria-label="홈으로 이동"]')?.getAttribute("href")).toBe("/home");
});

it("uses the back top navigation for a nested bookmark screen", async () => {
  await act(async () => root.render(<HeaderBar mobileBackHref="/bookmark" mobileBackLabel="북마크 목록으로 돌아가기" />));
  expect(host.querySelector('a[aria-label="북마크 목록으로 돌아가기"]')?.getAttribute("href")).toBe("/bookmark");
  expect(host.querySelector('a[aria-label="홈으로 이동"]')).toBeNull();
  expect(host.querySelector('a[aria-label="지도 보기"]')).toBeNull();
  expect(host.querySelector('button[aria-label="메뉴 열기"]')).toBeNull();
});

it("opens the mobile menu with working destinations and closes it with Escape", async () => {
  const menuButton = host.querySelector<HTMLButtonElement>('button[aria-label="메뉴 열기"]')!;
  expect(menuButton).not.toBeNull();
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).toBeNull();
  await act(async () => menuButton.click());
  const menu = host.querySelector('[aria-label="여행방 메뉴"]')!;
  expect(menu).not.toBeNull();
  expect(menu.querySelector('a[href="/member-settings"]')?.textContent).toContain("멤버 관리");
  expect(menu.querySelectorAll("a[href^='http']")).toHaveLength(2);
  expect(menu.querySelector('button')?.textContent).toContain("방 정보 수정");
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).toBeNull();
  expect(document.activeElement).toBe(menuButton);
});

it.each(["/bookmark", "/cost", "/search"])("shows the menu without a map toggle on %s", async pathname => {
  state.pathname = pathname;
  await rerender();
  expect(host.querySelector('a[aria-label="지도 보기"]')).toBeNull();
  expect(host.querySelector('button[aria-label="메뉴 열기"]')).not.toBeNull();
});

it("closes the menu on an outside pointer event", async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="메뉴 열기"]')!.click());
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).not.toBeNull();
  await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).toBeNull();
});

it("closes the open menu when the route changes", async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="메뉴 열기"]')!.click());
  state.pathname = "/cost";
  await rerender();
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).toBeNull();
});

it("closes the menu when a destination is selected", async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="메뉴 열기"]')!.click());
  await act(async () => host.querySelector<HTMLAnchorElement>('a[href="/member-settings"]')!.click());
  expect(host.querySelector('[aria-label="여행방 메뉴"]')).toBeNull();
});

it("keeps the folder's second back link hidden on mobile", () => {
  const detail = document.createElement("div");
  detail.innerHTML = renderToStaticMarkup(<BookmarkFolderDetailHeader folder={{ id: "folder", title: "맛집", color: "#ff0000" }} />);
  expect(detail.querySelector<HTMLAnchorElement>('a[href="/bookmark"]')?.className).toContain("mobile:hidden");
});

it("keeps the desktop title tokens and edit action", async () => {
  state.mobile = false;
  await rerender();
  const title = [...host.querySelectorAll("span")].find(x => x.textContent === "가을 여행");
  expect(title?.className).toContain("text-body-m-emphasis");
  expect(host.querySelector('button[aria-label="여행 정보 수정"]')).not.toBeNull();
  expect(host.querySelector('button[aria-label="메뉴 열기"]')).toBeNull();
});
