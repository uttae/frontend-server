// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/plan/room", query: "", mobile: false, unread: 0, roomId: "12345678-1234-1234-1234-123456789abc" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/hooks/useHostJoinRequestsBadgeCount", () => ({ useHostJoinRequestsBadgeCount: () => 2 }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: state.roomId }) }));
vi.mock("@/hooks/useRoomUnreadCount", () => ({ useRoomUnreadCount: () => ({ data: { unreadCount: state.unread } }) }));
vi.mock("@/hooks/useSessionPromptVisible", () => ({ useSessionPromptVisible: () => ({ visible: true, dismiss: vi.fn() }) }));
vi.mock("./HeaderBar", () => ({ default: ({ mobileBackHref }: { mobileBackHref?: string }) => <header data-mobile-back-href={mobileBackHref} /> }));
vi.mock("./LeftSection", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./SidebarTutorial", () => ({ SidebarTutorial: () => null }));
// External map/chat engines are boundaries; assertions exercise chrome selection and containment.
vi.mock("@/components/map", () => ({ MapWithDetailPanel: () => <div data-map /> }));
vi.mock("@/components/chat", () => ({ ChatPanel: ({ inline }: { inline?: boolean }) => <div data-chat data-inline={inline ? "true" : "false"} /> }));
import { MainLayoutChrome } from "./MainLayoutChrome";
import { useChatPanelStore } from "@/stores/chat-panel-store";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, { pathname: "/plan/room", query: "", mobile: false, unread: 0, roomId: "12345678-1234-1234-1234-123456789abc" });
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

it("opens the current room packing list from the desktop sidebar", async () => {
  await render();
  const packing = nav().querySelector<HTMLAnchorElement>('a[aria-label="준비물"]');
  expect(packing?.getAttribute("href")).toBe(`/packing/${state.roomId}`);
  state.pathname = `/packing/${state.roomId}`;
  await render();
  expect(active().map((item) => item.getAttribute("aria-label"))).toEqual(["준비물"]);
  expect(host.querySelector("[data-map]")).toBeNull();
});

it("switches between expenses and packing inside the mobile travel tools tab", async () => {
  state.mobile = true;
  state.pathname = "/cost";
  await render();
  const tools = host.querySelector<HTMLElement>('nav[aria-label="여행 도구 선택"]');
  expect([...tools!.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]))
    .toEqual([["가계부", "/cost"], ["준비물", `/packing/${state.roomId}`]]);
  expect(tools!.querySelector('[aria-current="page"]')?.textContent).toBe("가계부");
  state.pathname = `/packing/${state.roomId}`;
  await render();
  expect(host.querySelector('nav[aria-label="여행 도구 선택"] [aria-current="page"]')?.textContent).toBe("준비물");
  expect(nav().querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toBe("여행 도구");
});

it("desktop selects chat alone in the content panel and route links restore route content", async () => {
  await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(["일정", "검색", "북마크", "가계부", "준비물", "채팅", "멤버"]);
  expect(active()).toHaveLength(1);
  await act(async () => items()[5].click());
  expect(active()).toEqual([items()[5]]);
  expect(host.querySelector("article")).toBeNull();
  expect(host.querySelectorAll("[data-chat]")).toHaveLength(1);
  expect(host.querySelector("[data-main-content-scroll] [data-chat]")).not.toBeNull();
  expect(host.querySelectorAll("[data-map]")).toHaveLength(1);
  await act(async () => items()[0].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(host.querySelector("article")).not.toBeNull();
  expect(host.querySelector("[data-chat]")).toBeNull();
});
it("minimizing desktop chat restores the route content and docks chat over the map", async () => {
  await render();
  await act(async () => useChatPanelStore.getState().openChat());
  expect(host.querySelector('[data-main-content-scroll] [data-chat][data-inline="true"]')).not.toBeNull();
  await act(async () => useChatPanelStore.getState().minimizeChat());
  expect(host.querySelector("article")).not.toBeNull();
  expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
  expect(host.querySelector("[data-map]")).not.toBeNull();
});
it("external route changes close chat too", async () => {
  await render(); await act(async () => useChatPanelStore.getState().openChat());
  state.pathname = "/bookmark"; await render();
  expect(useChatPanelStore.getState().chatState).toBe("closed");
  expect(host.querySelector("[data-chat]")).toBeNull();
  expect(active()).toEqual([items()[2]]);
});
it.each([[4, "4"], [120, "99+"]])("retains unread value %i and the separate feedback survey", async (count, label) => {
  state.unread = count; await render();
  expect(items()[5].textContent).toContain(label);
  expect(host.querySelector('a[aria-label="피드백 설문"]')).not.toBeNull();
  expect(host.querySelector('a[href="/room-settings"]')).toBeNull();
});
it("hides the unread badge when no messages are unread", async () => {
  await render();
  expect(items()[5].querySelector("span.pointer-events-none")).toBeNull();
});
it("shows labeled feedback and bug report links in the sidebar", async () => {
  await render();
  const sidebar = host.querySelector("aside")!;
  expect(sidebar.querySelector('a[aria-label="피드백 설문"]')?.textContent).toContain("피드백");
  expect(sidebar.querySelector('a[aria-label="버그 제보"]')?.textContent).toContain("버그 제보");
});
it("mobile uses the four Figma destinations, with travel tools opening expenses", async () => {
  state.mobile = true; await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(["일정", "북마크", "여행 도구", "채팅"]);
  expect(items().map(x => x.getAttribute("href"))).toEqual(["/plan/room", "/bookmark", "/cost", "/plan/room?view=chat"]);
  expect(nav().className).toContain("safe-area-inset-bottom");
  expect(nav().querySelector('a[href="/search"]')).toBeNull();
  expect(items().every(item => item.querySelector('[style*="mask"]'))).toBe(true);
  expect(host.querySelector("article")!.compareDocumentPosition(nav()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  state.query = "view=map"; await render();
  expect(active()).toEqual([items()[0]]);
  expect(host.querySelector("article")).toBeNull();
  expect(host.querySelectorAll("[data-map]")).toHaveLength(1);
  state.query = "view=chat"; await render();
  expect(active()).toEqual([items()[3]]);
  expect(host.querySelectorAll("[data-chat]")).toHaveLength(1);
  expect(host.querySelector("[data-map]")).toBeNull();
});

it("shows unread messages on the mobile chat tab", async () => {
  state.mobile = true;
  state.unread = 4;
  await render();
  expect(items()[3].textContent).toContain("4");
});
it.each([false, true])("keeps one selected destination while visiting all route tabs (mobile=%s)", async mobile => {
  state.mobile = mobile;
  for (const [pathname, desktopIndex, mobileIndex] of [["/plan/room", 0, 0], ["/bookmark/folder", 2, 1], ["/cost", 3, 2]] as const) {
    state.pathname = pathname; await render();
    expect(active()).toEqual([items()[mobile ? mobileIndex : desktopIndex]]);
    expect(host.querySelector("[data-chat]")).toBeNull();
    expect(host.querySelector("article")).not.toBeNull();
  }
});

it.each(["/search", "/member-settings"])("keeps %s available outside the mobile tabs", async pathname => {
  state.mobile = true;
  state.pathname = pathname;
  await render();
  expect(active()).toHaveLength(0);
  expect(items()).toHaveLength(4);
});

it("uses the back header only within a bookmark folder", async () => {
  state.mobile = true;
  state.pathname = "/bookmark/folder";
  await render();
  expect(host.querySelector("header")?.getAttribute("data-mobile-back-href")).toBe("/bookmark");
  state.pathname = "/bookmark";
  await render();
  expect(host.querySelector("header")?.hasAttribute("data-mobile-back-href")).toBe(false);
});

it("cost follows bookmarks, selects alone and closes chat", async () => {
  await render();
  await act(async () => useChatPanelStore.getState().openChat());
  const cost = nav().querySelector<HTMLAnchorElement>('a[href="/cost"]');
  expect(cost).not.toBeNull();
  await act(async () => cost!.click());
  state.pathname = "/cost"; await render();
  expect(active()).toEqual([cost]);
  expect(host.querySelector("article")).not.toBeNull();
});

it.each(["/plan/room", "/cost"])("colors every sidebar icon consistently on %s", async pathname => {
  state.pathname = pathname;
  await render();
  expect(items()[3].querySelector("img")).toBeNull();
  for (const [index, item] of items().entries()) {
    const mask = item.querySelector<HTMLElement>('[style*="mask"]');
    expect(mask).not.toBeNull();
    const selected = pathname === "/cost" ? index === 3 : index === 0;
    expect(mask!.classList.contains("bg-primary-subtle")).toBe(selected);
    expect(mask!.classList.contains("bg-icon")).toBe(!selected);
    expect(mask!.classList.contains("size-6")).toBe(true);
  }
  expect(items()[3].querySelector<HTMLElement>('[style*="mask"]')!.style.maskImage).toContain("/icons/sidebar/calculator.svg");
});

it.each([false, true])("packing selects its desktop item or mobile travel tools tab (mobile=%s)", async mobile => {
  state.mobile = mobile;
  state.pathname = "/packing/12345678-1234-1234-1234-123456789abc";
  await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(mobile ? ["일정", "북마크", "여행 도구", "채팅"] : ["일정", "검색", "북마크", "가계부", "준비물", "채팅", "멤버"]);
  expect(active().map(item => item.getAttribute("aria-label"))).toEqual([mobile ? "여행 도구" : "준비물"]);
  expect(host.querySelector(`a[href="/packing/${state.roomId}"]`)).not.toBeNull();
  expect(host.querySelector("[data-map]")).toBeNull();
  expect(host.querySelector("[data-main-content-scroll]")?.className).toContain("overflow-hidden");
  expect(host.querySelector("[data-main-content-scroll]")?.className).not.toContain("overflow-y-auto");
  if (!mobile) {
    expect(host.querySelector("aside")?.parentElement?.className).toBe("hidden shrink-0 lg:flex");
    await act(async () => items()[5].click());
    expect(active()).toEqual([items()[5]]);
    expect(host.querySelector("[data-chat]")).not.toBeNull();
    await act(async () => useChatPanelStore.getState().closeChat());
    expect(host.querySelector("article")).not.toBeNull();
    expect(active().map(item => item.getAttribute("aria-label"))).toEqual(["준비물"]);
  }
});
