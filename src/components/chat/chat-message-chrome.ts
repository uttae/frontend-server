import { chatAssets } from "@/lib/public-assets";

export const chatMessageChrome = {
  bubbleBase: "w-fit rounded-xl px-4 py-2",
  otherBubble: "bg-[#f4f6f8] text-gray-900",
  mineBubble: "bg-primary text-white",
  aiBubble:
    "border border-ai-bubble-border bg-ai-bubble text-gray-900 shadow-sm shadow-slate-900/5",
  systemPill:
    "max-w-[min(100%,20rem)] rounded-full bg-black/25 px-4 py-2 text-center text-white",
  wooriIconSrc: chatAssets.woori,
} as const;

const chatMessageChromeMinimized = {
  bubbleBase: "w-fit rounded-lg px-3 py-1.5",
  systemPill:
    "max-w-[min(100%,18rem)] rounded-full bg-black/25 px-3 py-1.5 text-center text-white",
} as const;

export function getChatMessageChrome(isMinimized: boolean) {
  if (!isMinimized) return chatMessageChrome;
  return {
    ...chatMessageChrome,
    bubbleBase: chatMessageChromeMinimized.bubbleBase,
    systemPill: chatMessageChromeMinimized.systemPill,
  };
}
