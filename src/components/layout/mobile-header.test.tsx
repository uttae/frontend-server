// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mobile: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/plan/room", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRoomDetail", () => ({ useRoomDetail: () => ({ data: undefined }) }));
vi.mock("@/hooks/useRooms", () => ({ useRoomsList: () => ({ data: { rooms: [{ id: "room", title: "가을 여행", startDate: "2026-10-10", endDate: "2026-10-12" }] }, isPending: false }) }));
vi.mock("@/components/rooms/RoomTripEditDialog", () => ({ RoomTripEditDialog: () => <div role="dialog">정보 수정</div> }));
vi.mock("@/hooks/useSessionPromptVisible", () => ({ useSessionPromptVisible: () => ({ visible: false, dismiss: vi.fn() }) }));
import HeaderBar from "./HeaderBar";

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.mobile = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<HeaderBar />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

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
});
