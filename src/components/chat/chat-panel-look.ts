import { getChatMessageChrome } from "@/components/chat/chat-message-chrome";
import { resolveChatMessageTypography } from "@/components/chat/chat-typography";

export function getChatPanelLook(isMinimized: boolean) {
  return {
    typo: resolveChatMessageTypography(isMinimized),
    chrome: getChatMessageChrome(isMinimized),
  } as const;
}
