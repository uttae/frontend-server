// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));
vi.mock("@/components/chat", () => ({ ChatPanel: ({ inline }: { inline?: boolean }) => <div data-chat data-inline={inline ? "true" : "false"} /> }));

import ChatPage from "./page";
import { useChatPanelStore } from "@/stores/chat-panel-store";

it("뒤로가기·주소 입력으로 들어와도 최소화를 풀고 최대화 채팅을 그린다", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  useChatPanelStore.setState({ minimized: true });
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ChatPage />));
    expect(useChatPanelStore.getState().minimized).toBe(false);
    expect(host.querySelector('[data-chat][data-inline="true"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove();
  }
});
