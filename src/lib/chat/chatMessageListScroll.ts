import type { ChatMessage } from "@/types/chat";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export const CHAT_NEAR_BOTTOM_PX = 80;

export function scrollRootToBottomInstant(root: HTMLDivElement) {
  root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
}

export function setIsAtBottomIfChanged(
  setIsAtBottom: Dispatch<SetStateAction<boolean>>,
  near: boolean,
) {
  setIsAtBottom((prev) => (prev === near ? prev : near));
}

function freezeViewportAtReadBoundary(
  followTailRef: MutableRefObject<boolean>,
  setIsAtBottom: Dispatch<SetStateAction<boolean>>,
) {
  followTailRef.current = false;
  setIsAtBottomIfChanged(setIsAtBottom, false);
}

export function scrollReadBoundaryToBottom(
  root: HTMLDivElement,
  fallbackMessageId: string | undefined,
  groups: ChatMessage[][],
  followTailRef: MutableRefObject<boolean>,
  setIsAtBottom: Dispatch<SetStateAction<boolean>>,
) {
  const divider = root.querySelector("[data-chat-read-divider]");
  if (divider instanceof HTMLElement) {
    divider.scrollIntoView({ behavior: "auto", block: "end" });
    freezeViewportAtReadBoundary(followTailRef, setIsAtBottom);
    return;
  }

  if (!fallbackMessageId) {
    scrollRootToBottomInstant(root);
    followTailRef.current = true;
    setIsAtBottomIfChanged(setIsAtBottom, true);
    return;
  }

  const headId =
    groups.find((g) => g.some((m) => m.id === fallbackMessageId))?.[0]?.id ??
    fallbackMessageId;
  const el = root.querySelector(`[data-chat-anchor="${CSS.escape(headId)}"]`);
  if (el instanceof HTMLElement) {
    el.scrollIntoView({ behavior: "auto", block: "end" });
    freezeViewportAtReadBoundary(followTailRef, setIsAtBottom);
    return;
  }

  scrollRootToBottomInstant(root);
  followTailRef.current = true;
  setIsAtBottomIfChanged(setIsAtBottom, true);
}

export function applyScrollAnchor(
  root: HTMLDivElement,
  followTail: boolean,
  distFromBottom: number,
) {
  if (followTail) {
    scrollRootToBottomInstant(root);
    return;
  }
  root.scrollTop = Math.max(
    0,
    root.scrollHeight - root.clientHeight - distFromBottom,
  );
}
