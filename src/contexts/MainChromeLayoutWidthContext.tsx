"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type RefCallback,
} from "react";
import { usePathname } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useSectionWidth } from "@/contexts/SectionWidthContext";
import { useChat } from "@/hooks/useChat";
import { useLeftSectionWidthMeasure } from "@/hooks/useLeftSectionWidthMeasure";
import { usePlanChatPanelReveal } from "@/hooks/usePlanChatPanelReveal";
import {
  MAIN_LAYOUT_WIDTH_TRANSITION,
  resolveChatPanelDockWidthCss,
  resolveLeftSectionAnimateMaxWidth,
  resolveLeftSectionMinWidthPx,
  resolveLeftSectionTargetMaxWidthPx,
} from "@/lib/layout/mainChromeLayoutWidth";

export type MainChromeLayoutWidth = {
  setLeftSectionRef: RefCallback<HTMLElement>;
  leftSectionAnimateMaxWidth: string;
  leftSectionAnimateMinWidth: number | string;
  layoutTransition: typeof MAIN_LAYOUT_WIDTH_TRANSITION;
  /** maximized — `ChatPanel` `style.width` 전용 (minimize는 `w-72` 고정) */
  chatPanelDockWidthCss: string | null;
  /** 플랜: LeftSection 축소 후 maximized 패널 마운트 */
  chatPanelRevealReady: boolean;
};

const MainChromeLayoutWidthContext =
  createContext<MainChromeLayoutWidth | null>(null);

export function MainChromeLayoutWidthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { maxWidth: contentWidthToken } = useSectionWidth();
  const { chatState } = useChat();
  const { isMobileDevice } = useMobileView();
  const { setLeftSectionRef, measuredLeftWidthPx } = useLeftSectionWidthMeasure();

  const targetMaxWidthPx = useMemo(
    () =>
      resolveLeftSectionTargetMaxWidthPx({
        pathname,
        contentWidthToken,
        chatState,
        isMobile: isMobileDevice,
      }),
    [pathname, contentWidthToken, chatState, isMobileDevice],
  );

  const chatPanelRevealReady = usePlanChatPanelReveal({
    pathname,
    chatState,
    isMobile: isMobileDevice,
    targetMaxWidthPx,
    measuredLeftWidthPx,
  });

  const value = useMemo<MainChromeLayoutWidth>(
    () => ({
      setLeftSectionRef,
      leftSectionAnimateMaxWidth: resolveLeftSectionAnimateMaxWidth({
        targetMaxWidthPx,
        isMobile: isMobileDevice,
      }),
      leftSectionAnimateMinWidth: resolveLeftSectionMinWidthPx(isMobileDevice, pathname),
      layoutTransition: MAIN_LAYOUT_WIDTH_TRANSITION,
      chatPanelDockWidthCss: resolveChatPanelDockWidthCss({
        pathname,
        chatState,
        isMobile: isMobileDevice,
        measuredLeftWidthPx,
        targetMaxWidthPx,
      }),
      chatPanelRevealReady,
    }),
    [
      setLeftSectionRef,
      targetMaxWidthPx,
      isMobileDevice,
      chatState,
      measuredLeftWidthPx,
      pathname,
      chatPanelRevealReady,
    ],
  );

  return (
    <MainChromeLayoutWidthContext.Provider value={value}>
      {children}
    </MainChromeLayoutWidthContext.Provider>
  );
}

export function useMainChromeLayoutWidth(): MainChromeLayoutWidth {
  const ctx = useContext(MainChromeLayoutWidthContext);
  if (!ctx) {
    throw new Error(
      "useMainChromeLayoutWidth must be used within MainChromeLayoutWidthProvider",
    );
  }
  return ctx;
}
