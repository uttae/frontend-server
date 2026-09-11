// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ sendAi: vi.fn(), sendChat: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/MainChromeLayoutWidthContext", () => ({ useMainChromeLayoutWidth: () => ({ chatPanelDockWidthCss: "480px", chatPanelRevealReady: true }) }));
vi.mock("@/hooks/useCurrentRoomTitle", () => ({ useCurrentRoomTitle: () => "제주 여행" }));
vi.mock("@/hooks/use-room-id", () => ({ useCurrentRoomId: () => ({ roomId: "room" }) }));
vi.mock("@/hooks/useRooms", () => ({ useRoomMembers: () => ({ data: { members: [] } }) }));
vi.mock("@/hooks/useChatMessages", () => ({ useChatMessages: () => ({
  messages: [{ id: "hello", type: "system", text: "여행 대화를 시작합니다" }],
  sendChatMessage: boundary.sendChat, sendAiMessage: boundary.sendAi,
  sendCancelAiRequest: vi.fn(), fetchOlderMessages: vi.fn(), fetchNewerMessages: vi.fn(),
  jumpToLatest: vi.fn(), hasMore: false, hasMoreNewer: false,
  isFetchingOlder: false, isFetchingNewer: false, readMarkerMessageId: null,
  readDividerPlacement: null, scrollToAnchor: null, markMessagesRead: vi.fn(),
}) }));
vi.mock("@/lib/client-env", () => ({ clientEnv: {
  NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:9", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "synthetic",
  NEXT_PUBLIC_GOOGLE_REDIRECT_URI: "http://127.0.0.1:9", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "synthetic",
} }));
import { ChatPanel } from "./ChatPanel";
import { useChatPanelStore } from "@/stores/chat-panel-store";

it("keeps messages and the working AI composer inside one inline panel", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  useChatPanelStore.getState().openChat();
  try {
    await act(async () => root.render(<ChatPanel inline />));
    expect(host.querySelectorAll("textarea")).toHaveLength(1);
    expect(host.textContent).toContain("여행 대화를 시작합니다");
    expect(host.querySelector('[aria-label="최소화"]')).toBeNull();
    expect(host.firstElementChild?.className).not.toContain("absolute");
    const ai = [...host.querySelectorAll("button")].find(button => button.textContent === "@ai")!;
    await act(async () => ai.click());
    const suggest = host.querySelector<HTMLButtonElement>('[aria-label="입력란에 장소 추천 요청 문구 넣기"]')!;
    await act(async () => suggest.click());
    const input = host.querySelector("textarea")!;
    expect(input.value.length).toBeGreaterThan(0);
    const text = input.value;
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(boundary.sendAi).toHaveBeenCalledWith(text);
    expect(boundary.sendChat).not.toHaveBeenCalled();
    expect(host.querySelectorAll("textarea")).toHaveLength(1);
  } finally {
    await act(async () => root.unmount()); host.remove();
    useChatPanelStore.getState().closeChat(); vi.unstubAllGlobals();
  }
});
