// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { useRoomUnreadCount } from "./useRoomUnreadCount";
import { useChatPanelStore } from "@/stores/chat-panel-store";
const state = vi.hoisted(() => ({ mobile: true, path: "/plan/room", view: "chat", fetch: vi.fn(async () => ({ unreadCount: 2 })) }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useSearchParams: () => new URLSearchParams({ view: state.view }) }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: state.mobile }) }));
vi.mock("@/lib/api/rooms", () => ({ getRoomUnreadCount: state.fetch }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("does not fetch while mobile chat is visible, and resumes when leaving chat", async () => {
  useChatPanelStore.getState().closeChat();
  const client = new QueryClient();
  const hook = hookHarness(() => useRoomUnreadCount("room"), child => <QueryClientProvider client={client}>{child}</QueryClientProvider>);
  try {
    await hook.render(undefined);
    expect(state.fetch).not.toHaveBeenCalled();
    state.view = "schedule";
    await hook.render(undefined);
    await hook.flush();
    expect(hook.current.data).toEqual({ unreadCount: 2 });
  } finally {
    await hook.unmount();
    client.clear();
  }
});
it.each([
  { mobile: false, path: "/plan/room", view: "chat", open: false, enabled: true },
  { mobile: false, path: "/plan/room", view: "schedule", open: true, enabled: false },
  { mobile: true, path: "/plan/room", view: "map", open: true, enabled: true },
  { mobile: true, path: "/search", view: "chat", open: false, enabled: true },
])("uses actual chat visibility: %j", async ({ mobile, path, view, open, enabled }) => {
  Object.assign(state, { mobile, path, view });
  state.fetch.mockClear();
  if (open) useChatPanelStore.getState().openChat();
  else useChatPanelStore.getState().closeChat();
  const client = new QueryClient();
  const hook = hookHarness(() => useRoomUnreadCount("room"), child => <QueryClientProvider client={client}>{child}</QueryClientProvider>);
  try {
    await hook.render(undefined);
    await hook.flush();
    expect(hook.current.data).toEqual(enabled ? { unreadCount: 2 } : undefined);
  } finally {
    await hook.unmount();
    client.clear();
    useChatPanelStore.getState().closeChat();
  }
});
