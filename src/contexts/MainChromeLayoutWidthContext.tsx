"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useSectionWidth } from "@/contexts/SectionWidthContext";
import {
  MAIN_LAYOUT_WIDTH_TRANSITION,
  resolveLeftSectionAnimateMaxWidth,
  resolveLeftSectionMinWidthPx,
  resolveLeftSectionTargetMaxWidthPx,
} from "@/lib/layout/mainChromeLayoutWidth";

export type MainChromeLayoutWidth = {
  leftSectionAnimateMaxWidth: string;
  leftSectionAnimateMinWidth: number | string;
  layoutTransition: typeof MAIN_LAYOUT_WIDTH_TRANSITION;
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
  const { isMobileDevice } = useMobileView();

  const targetMaxWidthPx = useMemo(
    () =>
      resolveLeftSectionTargetMaxWidthPx({
        pathname,
        contentWidthToken,
        isMobile: isMobileDevice,
      }),
    [pathname, contentWidthToken, isMobileDevice],
  );

  const value = useMemo<MainChromeLayoutWidth>(
    () => ({
      leftSectionAnimateMaxWidth: resolveLeftSectionAnimateMaxWidth({
        targetMaxWidthPx,
        isMobile: isMobileDevice,
      }),
      leftSectionAnimateMinWidth: resolveLeftSectionMinWidthPx(isMobileDevice, pathname),
      layoutTransition: MAIN_LAYOUT_WIDTH_TRANSITION,
    }),
    [targetMaxWidthPx, isMobileDevice, pathname],
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
