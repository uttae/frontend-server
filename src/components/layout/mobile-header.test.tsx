// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mobile: true, pathname: "/plan/room" }));
vi.mock("@/components/layout/HeaderMemberPreview", () => ({ HeaderMemberPreview: () => null }));
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
// 메뉴는 Base UI Menu라 document.body로 포털된다. 항목은 role="menuitem"(방 정보 수정은 div, 이동 항목은 a)
const menu = () => document.querySelector<HTMLElement>('[role="menu"][aria-label="여행방 메뉴"]');
const menuButton = () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;

it("shows the room details and map action in the mobile top navigation", () => {
  expect(host.querySelector("header")?.textContent).toContain("가을 여행");
  expect(host.querySelector("header")?.textContent).toContain("26/10/10 - 26/10/12");
  expect(host.querySelector('a[aria-label="지도 보기"]')?.getAttribute("href")).toBe("/map");
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
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="메뉴 열기"]')!;
  expect(trigger).not.toBeNull();
  expect(menu()).toBeNull();
  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-label")).toBe("메뉴 닫기");
  const items = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  expect(items.map(item => item.textContent)).toEqual(["방 정보 수정", "초대하기", "피드백", "버그 제보"]);
  expect(menu()!.querySelector('a[role="menuitem"][href="/member-settings"]')?.textContent).toContain("초대하기");
  expect(menu()!.querySelectorAll("a[role='menuitem'][href^='http']")).toHaveLength(2);
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(menu()).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-label")).toBe("메뉴 열기");
});

it.each(["/bookmark", "/cost", "/packing/12345678-1234-1234-1234-123456789abc"])("shows the map shortcut on %s", async pathname => {
  state.pathname = pathname;
  await rerender();
  expect(host.querySelector('a[aria-label="지도 보기"]')?.getAttribute("href")).toBe("/map");
  expect(host.querySelector('button[aria-label="메뉴 열기"]')).not.toBeNull();
});

it("keeps the map shortcut on the mobile chat screen", async () => {
  state.pathname = "/chat";
  await rerender();
  expect(host.querySelector('a[aria-label="지도 보기"]')?.getAttribute("href")).toBe("/map");
});

it("switches the shortcut to the schedule on the map screen", async () => {
  state.pathname = "/map";
  await rerender();
  expect(host.querySelector('a[aria-label="일정 보기"]')?.getAttribute("href")).toBe("/plan");
  expect(host.querySelector('a[aria-label="지도 보기"]')).toBeNull();
});

it("keeps the map shortcut hidden on search", async () => {
  state.pathname = "/search";
  await rerender();
  expect(host.querySelector('a[aria-label="지도 보기"]')).toBeNull();
});

it("closes the menu on an outside pointer event", async () => {
  await act(async () => menuButton().click());
  expect(menu()).not.toBeNull();
  await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(menu()).toBeNull();
});

it("closes the open menu when the route changes", async () => {
  await act(async () => menuButton().click());
  expect(menu()).not.toBeNull();
  state.pathname = "/cost";
  await rerender();
  expect(menu()).toBeNull();
});

it("closes the menu when a destination is selected", async () => {
  await act(async () => menuButton().click());
  await act(async () => menu()!.querySelector<HTMLAnchorElement>('a[href="/member-settings"]')!.click());
  expect(menu()).toBeNull();
});

it("opens the trip edit dialog from the menu item and closes the menu", async () => {
  await act(async () => menuButton().click());
  const edit = [...menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(item => item.textContent === "방 정보 수정")!;
  await act(async () => edit.click());
  expect(menu()).toBeNull();
  expect(host.querySelector('[role="dialog"]')?.textContent).toBe("정보 수정");
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
