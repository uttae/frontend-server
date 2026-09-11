// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/plan/room", query: "", mobile: false, unread: 0 }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/hooks/useMobileRedirects", () => ({ useMainMobileRouteRedirect: () => {} }));
vi.mock("@/hooks/useHostJoinRequestsBadgeCount", () => ({ useHostJoinRequestsBadgeCount: () => 2 }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRoomUnreadCount", () => ({ useRoomUnreadCount: () => ({ data: { unreadCount: state.unread } }) }));
vi.mock("@/hooks/useSessionPromptVisible", () => ({ useSessionPromptVisible: () => ({ visible: true, dismiss: vi.fn() }) }));
vi.mock("./HeaderBar", () => ({ default: () => <header /> }));
vi.mock("./LeftSection", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./SidebarTutorial", () => ({ SidebarTutorial: () => null }));
vi.mock("@/components/mobile/MobileReadOnlyNotice", () => ({ MobileReadOnlyNotice: () => null }));
// External map/chat engines are boundaries; assertions exercise chrome selection and containment.
vi.mock("@/components/map", () => ({ MapWithDetailPanel: () => <div data-map /> }));
vi.mock("@/components/chat", () => ({ ChatPanel: () => <div data-chat /> }));
import { MainLayoutChrome } from "./MainLayoutChrome";
import { useChatPanelStore } from "@/stores/chat-panel-store";
import { isMainRouteBlockedOnMobile } from "@/lib/mobile-view/routes";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, { pathname: "/plan/room", query: "", mobile: false, unread: 0 });
  useChatPanelStore.getState().closeChat();
  HTMLElement.prototype.scrollTo = vi.fn();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  host.addEventListener("click", event => event.preventDefault());
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(<MainLayoutChrome><article>일정 본문</article></MainLayoutChrome>)); }
function nav() { return host.querySelector('nav[aria-label="여행 주요 메뉴"],nav[aria-label="모바일 주요 메뉴"]')!; }
function items() { return [...nav().querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a,button")]; }
function active() { return [...nav().querySelectorAll('[aria-current="page"], [aria-pressed="true"]')]; }

it("desktop selects chat alone in the content panel and route links restore route content", async () => {
  await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(["일정", "검색", "북마크", "채팅", "멤버"]);
  expect(active()).toHaveLength(1);
  await act(async () => items()[3].click());
  expect(active()).toEqual([items()[3]]);
  expect(host.querySelector("article")).toBeNull();
  expect(host.querySelectorAll("[data-chat]")).toHaveLength(1);
  expect(host.querySelector("[data-main-content-scroll] [data-chat]")).not.toBeNull();
  expect(host.querySelectorAll("[data-map]")).toHaveLength(1);
  await act(async () => items()[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(host.querySelector("article")).not.toBeNull();
  expect(host.querySelector("[data-chat]")).toBeNull();
});
it("external route changes close chat too", async () => {
  await render(); await act(async () => useChatPanelStore.getState().openChat());
  state.pathname = "/bookmark"; await render();
  expect(useChatPanelStore.getState().chatState).toBe("closed");
  expect(host.querySelector("[data-chat]")).toBeNull();
  expect(active()).toEqual([items()[2]]);
});
it.each([[0, "-"], [4, "4"], [120, "99+"]])("retains unread value %i and the separate feedback survey", async (count, label) => {
  state.unread = count; await render();
  expect(items()[3].textContent).toContain(label);
  expect(host.querySelector('a[aria-label="피드백 설문"]')).not.toBeNull();
  expect(host.querySelector('a[href="/room-settings"]')).toBeNull();
});
it("omits the sidebar contact entry while retaining the separate feedback survey", async () => {
  await render();
  const sidebar = host.querySelector("aside")!;
  expect(sidebar.querySelector('a[aria-label="피드백 설문"]')).not.toBeNull();
  expect(sidebar.querySelector('a[aria-label="버그 제보"], a[href="/contact"]')).toBeNull();
});
it("mobile has five bottom destinations and retains the existing map/schedule URLs outside them", async () => {
  state.mobile = true; await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(["일정", "검색", "북마크", "채팅", "멤버"]);
  expect(items().map(x => x.getAttribute("href"))).toEqual(["/plan/room", "/search", "/bookmark", "/plan/room?view=chat", "/member-settings"]);
  expect(host.querySelector("article")!.compareDocumentPosition(nav()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(nav().className).toContain("safe-area-inset-bottom");
  expect(host.querySelector('a[href="/plan/room?view=map"]')).not.toBeNull();
  state.query = "view=map"; await render();
  expect(active()).toEqual([items()[0]]);
  expect(host.querySelector("article")).toBeNull();
  expect(host.querySelectorAll("[data-map]")).toHaveLength(1);
  state.query = "view=chat"; await render();
  expect(active()).toEqual([items()[3]]);
  expect(host.querySelectorAll("[data-chat]")).toHaveLength(1);
  expect(host.querySelector("[data-map]")).toBeNull();
});
it("allows mobile search without widening blocked settings/contact routes", () => {
  expect(isMainRouteBlockedOnMobile("/search")).toBe(false);
  expect(isMainRouteBlockedOnMobile("/settings")).toBe(true);
  expect(isMainRouteBlockedOnMobile("/contact")).toBe(true);
});

it.each([false, true])("keeps one selected destination while visiting all route tabs (mobile=%s)", async mobile => {
  state.mobile = mobile;
  for (const [pathname, index] of [["/plan/room", 0], ["/search", 1], ["/bookmark/folder", 2], ["/member-settings", 4]] as const) {
    state.pathname = pathname; await render();
    expect(active()).toEqual([items()[index]]);
    expect(host.querySelector("[data-chat]")).toBeNull();
    expect(host.querySelector("article")).not.toBeNull();
  }
});
