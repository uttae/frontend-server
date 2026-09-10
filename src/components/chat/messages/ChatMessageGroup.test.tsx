import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/types/chat";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:9";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://127.0.0.1/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
});

import { MyMessageGroup, OtherMessageGroup } from "./ChatMessageGroup";

describe.each([
  { sender: "mine", Group: MyMessageGroup },
  { sender: "other", Group: OtherMessageGroup },
] as const)("$sender message group", ({ sender, Group }) => {
  describe.each([false, true])("minimized=%s", (isMinimized) => {
    const message: ChatMessage = {
      id: "synthetic-message",
      type: sender,
      sender: "테스트 친구",
      text: "여행 장소를 추천해 주세요",
    };

    it("renders the AI mention with readable foreground and the panel font size", () => {
      const html = renderToStaticMarkup(
        <Group messages={[{ ...message, isAiRequest: true }]} isMinimized={isMinimized} />,
      );
      const mentions = [...html.matchAll(/<span class="([^"]*)">@ai<\/span>/g)];

      expect(mentions).toHaveLength(1);
      const classes = mentions[0][1].split(/\s+/);
      expect(classes).toContain("text-text");
      expect(classes).not.toContain("text-white");
      expect(classes).toContain(isMinimized ? "text-[13px]" : "text-[14px]");
      expect(classes).not.toContain(isMinimized ? "text-[14px]" : "text-[13px]");
      expect(html).toContain(message.text);
    });

    it("does not add an AI mention to an ordinary message", () => {
      const html = renderToStaticMarkup(
        <Group messages={[message]} isMinimized={isMinimized} />,
      );

      expect(html).not.toContain("@ai");
      expect(html).not.toContain("data-chat-anchor");
      expect(html).toContain(message.text);
    });
  });
});
