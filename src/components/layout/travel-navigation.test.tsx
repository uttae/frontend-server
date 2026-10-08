// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/plan/room", query: "", mobile: false, unread: 0, roomId: "12345678-1234-1234-1234-123456789abc", replace: (() => {}) as (href: string) => void }));
// 실제 이동처럼 push·back이 경로와 기록을 바꾼다 — 다음 render()에서 반영된다
const history = vi.hoisted(() => [] as string[]);
const push = vi.hoisted(() => (href: string) => { history.push(state.pathname); state.pathname = href.split("?")[0]; });
const back = vi.hoisted(() => () => { state.pathname = history.pop() ?? state.pathname; });
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useSearchParams: () => new URLSearchParams(state.query), useRouter: () => ({ replace: state.replace, push, back }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/hooks/useHostJoinRequestsBadgeCount", () => ({ useHostJoinRequestsBadgeCount: () => 2 }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: state.roomId }) }));
vi.mock("@/hooks/useRoomUnreadCount", () => ({ useRoomUnreadCount: () => ({ data: { unreadCount: state.unread } }) }));
vi.mock("@/hooks/useSessionPromptVisible", () => ({ useSessionPromptVisible: () => ({ visible: true, dismiss: vi.fn() }) }));
vi.mock("./HeaderBar", () => ({ default: ({ mobileBackHref }: { mobileBackHref?: string }) => <header data-mobile-back-href={mobileBackHref} /> }));
vi.mock("./LeftSection", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
// External map/chat engines are boundaries; assertions exercise chrome selection and containment.
vi.mock("@/components/map", () => ({ MapWithDetailPanel: ({ hidden }: { hidden?: boolean }) => <div data-map hidden={hidden} /> }));
vi.mock("@/components/chat", () => ({ ChatPanel: ({ inline }: { inline?: boolean }) => <div data-chat data-inline={inline ? "true" : "false"} /> }));
import { MainLayoutChrome } from "./MainLayoutChrome";
import { useChatPanelStore } from "@/stores/chat-panel-store";
import { useChat } from "@/hooks/useChat";

/** 채팅 패널 헤더의 최소화·닫기 버튼 대신 — 실제 `useChat` 동작을 누른다 */
function ChatControls() {
  const { minimizeChat, closeChat } = useChat();
  return <div><button data-control="minimize" onClick={minimizeChat} /><button data-control="close" onClick={closeChat} /></div>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(state, { pathname: "/plan/room", query: "", mobile: false, unread: 0, roomId: "12345678-1234-1234-1234-123456789abc", replace: vi.fn() });
  useChatPanelStore.setState({ minimized: false, returnPath: "/plan", openedInApp: false });
  history.length = 0;
  HTMLElement.prototype.scrollTo = vi.fn();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  host.addEventListener("click", event => event.preventDefault());
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render() { await act(async () => root.render(<><MainLayoutChrome><article>일정 본문</article></MainLayoutChrome><ChatControls /></>)); }
async function control(name: "minimize" | "close") { await act(async () => host.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!.click()); await render(); }
async function openChatFromSidebar() { await act(async () => items()[5].click()); await render(); }
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
  expect(host.querySelector("[data-map]:not([hidden])")).toBeNull();
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

it("desktop chat menu opens the /chat route next to the map, and route links leave it", async () => {
  await render();
  expect(items().map(x => x.getAttribute("aria-label") ?? x.textContent)).toEqual(["일정", "검색", "북마크", "가계부", "준비물", "채팅", "멤버"]);
  expect(active()).toHaveLength(1);
  await openChatFromSidebar();
  expect(state.pathname).toBe("/chat");
  expect(active()).toEqual([items()[5]]);
  // 최대화 채팅은 `/chat` 페이지(본문)가 그린다 — 레이아웃은 지도만 옆에 둔다
  expect(host.querySelector("[data-chat]")).toBeNull();
  expect(host.querySelectorAll("[data-map]:not([hidden])")).toHaveLength(1);
  state.pathname = "/plan/room"; await render();
  expect(active()).toEqual([items()[0]]);
  expect(host.querySelector("[data-chat]")).toBeNull();
});
it("minimizing desktop chat returns to the previous route and docks chat over the map", async () => {
  await render();
  await openChatFromSidebar();
  await control("minimize");
  expect(state.pathname).toBe("/plan/room");
  expect(host.querySelector("article")).not.toBeNull();
  expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
  expect(host.querySelector("[data-map]")).not.toBeNull();
});
it("minimizing goes back in history instead of stacking entries; direct /chat entry replaces to /plan", async () => {
  state.pathname = "/bookmark"; await render();
  await openChatFromSidebar();
  await control("minimize");
  expect(state.pathname).toBe("/bookmark");
  expect(history).toEqual([]);
  // 주소로 바로 들어온 `/chat` — 앞 기록이 없으므로 /plan으로 바꾼다
  useChatPanelStore.setState({ minimized: false, openedInApp: false, returnPath: "/plan" });
  state.pathname = "/chat"; await render();
  await control("close");
  expect(state.replace).toHaveBeenLastCalledWith("/plan");
});
it("leaving /chat through a menu closes chat without a minimized panel", async () => {
  await render();
  await openChatFromSidebar();
  state.pathname = "/bookmark"; await render();
  expect(host.querySelector("[data-chat]")).toBeNull();
  expect(active()).toEqual([items()[2]]);
});
it("minimized chat follows route changes and same-menu clicks", async () => {
  await render();
  await openChatFromSidebar();
  await control("minimize");
  state.pathname = "/bookmark"; await render();
  expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
  await act(async () => nav().querySelector<HTMLAnchorElement>('a[href="/bookmark"]')!.click());
  await render();
  expect(useChatPanelStore.getState().minimized).toBe(true);
  expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
});
it("closing the chat on /chat returns to the previous route; reopening comes back to /chat", async () => {
  state.pathname = "/bookmark"; await render();
  await openChatFromSidebar();
  await control("close");
  expect(state.pathname).toBe("/bookmark");
  expect(host.querySelector("[data-chat]")).toBeNull();
  await openChatFromSidebar();
  expect(state.pathname).toBe("/chat");
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
  expect(items().map(x => x.getAttribute("href"))).toEqual(["/plan/room", "/bookmark", "/cost", "/chat"]);
  expect(nav().className).toContain("safe-area-inset-bottom");
  expect(nav().querySelector('a[href="/search"]')).toBeNull();
  expect(items().every(item => item.querySelector('[style*="mask"]'))).toBe(true);
  expect(host.querySelector("article")!.compareDocumentPosition(nav()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // 지도·채팅은 각자의 페이지가 본문을 그리고, 레이아웃은 탭만 고른다
  state.pathname = "/map"; await render();
  expect(active()).toEqual([items()[0]]);
  expect(items()[0].getAttribute("href")).toBe("/plan");
  expect(host.querySelector("article")).not.toBeNull();
  state.pathname = "/chat"; await render();
  expect(active()).toEqual([items()[3]]);
  expect(host.querySelector("[data-chat]")).toBeNull();
  expect(host.querySelector("[data-map]:not([hidden])")).toBeNull();
});

it("moves old mobile ?view=map|chat links to /map and /chat", async () => {
  state.mobile = true;
  state.query = "view=map"; await render();
  expect(state.replace).toHaveBeenLastCalledWith("/map");
  state.query = "view=chat"; await render();
  expect(state.replace).toHaveBeenLastCalledWith("/chat");
  // 옮기는 동안에는 일정 본문을 그리지 않는다(깜빡임 방지)
  expect(host.querySelector("article")).toBeNull();
  vi.mocked(state.replace).mockClear();
  state.mobile = false; await render();
  expect(state.replace).not.toHaveBeenCalled();
  expect(host.querySelector("article")).not.toBeNull();
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

it("uses the back header only within a bookmark folder and on the map", async () => {
  state.mobile = true;
  state.pathname = "/bookmark/folder";
  await render();
  expect(host.querySelector("header")?.getAttribute("data-mobile-back-href")).toBe("/bookmark");
  state.pathname = "/bookmark";
  await render();
  expect(host.querySelector("header")?.hasAttribute("data-mobile-back-href")).toBe(false);
  state.pathname = "/map";
  await render();
  expect(host.querySelector("header")?.getAttribute("data-mobile-back-href")).toBe("/plan");
  state.pathname = "/chat";
  await render();
  expect(host.querySelector("header")?.hasAttribute("data-mobile-back-href")).toBe(false);
});

it("cost follows bookmarks, selects alone and closes chat", async () => {
  await render();
  await openChatFromSidebar();
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
  expect(host.querySelector("[data-map]:not([hidden])")).toBeNull();
  expect(host.querySelector("[data-main-content-scroll]")?.className).toContain("overflow-hidden");
  expect(host.querySelector("[data-main-content-scroll]")?.className).not.toContain("overflow-y-auto");
  if (!mobile) {
    await openChatFromSidebar();
    expect(active()).toEqual([items()[5]]);
    // 준비물은 지도 없이 전체 폭이지만, 채팅(`/chat`)은 지도 옆에 연다
    expect(host.querySelector("[data-map]:not([hidden])")).not.toBeNull();
    await control("minimize");
    expect(state.pathname).toBe(`/packing/${state.roomId}`);
    expect(host.querySelector("article")).not.toBeNull();
    expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
    expect(host.querySelector("[data-map]:not([hidden])")).toBeNull();
    await control("close");
    expect(host.querySelector("[data-chat]")).toBeNull();
    expect(host.querySelector("article")).not.toBeNull();
    expect(host.querySelector("[data-map]:not([hidden])")).toBeNull();
    expect(active().map(item => item.getAttribute("aria-label"))).toEqual(["준비물"]);
  } else {
    expect(host.querySelector("aside")).toBeNull();
    expect(host.querySelector("[data-chat]")).toBeNull();
  }
});

it('keeps /chat until another route commits, then shows that route', async () => {
 state.pathname=`/packing/${state.roomId}`;
 await render();
 await openChatFromSidebar();
 await act(async()=>items()[6].click());
 expect(state.pathname).toBe('/chat');
 expect(active().map(item=>item.getAttribute('aria-label'))).toEqual(['채팅']);
 state.pathname='/member-settings';
 await render();
 expect(host.querySelector('[data-chat]')).toBeNull();
 expect(active().map(item=>item.getAttribute('aria-label'))).toEqual(['멤버']);
});
it('links back to the original packing tab from /chat', async () => {
 state.pathname=`/packing/${state.roomId}`;
 await render();
 await openChatFromSidebar();
 expect(items()[4].getAttribute('href')).toBe(`/packing/${state.roomId}`);
 state.pathname=`/packing/${state.roomId}`; await render();
 expect(host.querySelector('[data-chat]')).toBeNull();
 expect(active().map(item=>item.getAttribute('aria-label'))).toEqual(['준비물']);
});

it('creates the desktop map lazily and preserves the same map through full-width tabs', async () => {
 state.pathname='/cost'; await render();
 expect(host.querySelector('[data-map]')).toBeNull();
 state.pathname=`/packing/${state.roomId}`; await render();
 expect(host.querySelector('[data-map]')).toBeNull();
 state.pathname='/plan/room'; await render();
 const map=host.querySelector<HTMLElement>('[data-map]')!;
 expect(map).not.toBeNull();
 for(const pathname of ['/cost',`/packing/${state.roomId}`,'/plan/room']) {
  state.pathname=pathname; await render();
  expect(host.querySelector('[data-map]')).toBe(map);
  expect(map.hidden).toBe(pathname!=='/plan/room');
 }
 state.roomId='another-room'; await render();
 expect(host.querySelector('[data-map]')).not.toBe(map);
});

it.each([
  ['/plan/room', '일정'],
  ['/bookmark', '북마크'],
  ['/cost', '가계부'],
  ['/packing/12345678-1234-1234-1234-123456789abc', '준비물'],
  ['/member-settings', '멤버'],
])('selects the visible route after minimizing chat on %s', async (pathname, label) => {
  state.pathname = pathname;
  await render();
  await openChatFromSidebar();
  expect(active().map(item => item.getAttribute('aria-label'))).toEqual(['채팅']);
  await control('minimize');
  expect(state.pathname).toBe(pathname);
  expect(active().map(item => item.getAttribute('aria-label'))).toEqual([label]);
  expect(host.querySelector('[data-chat][data-inline="false"]')).not.toBeNull();
  // 최소화 중에 채팅에 들어가면 최대화(`/chat`)되고, 메뉴로 나가도 최소화 창이 다시 뜨지 않는다
  await openChatFromSidebar();
  expect(state.pathname).toBe('/chat');
  expect(active().map(item => item.getAttribute('aria-label'))).toEqual(['채팅']);
  expect(host.querySelector('[data-chat]')).toBeNull();
  state.pathname = pathname; await render();
  expect(host.querySelector('[data-chat]')).toBeNull();
});
