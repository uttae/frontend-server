"use client";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useMainChromeLayoutWidth } from "@/contexts/MainChromeLayoutWidthContext";

export default function LeftSection({ children }: { children: React.ReactNode }) {
  const { isMobileDevice } = useMobileView();
  const { leftSectionAnimateMaxWidth, leftSectionAnimateMinWidth, layoutTransition } = useMainChromeLayoutWidth();
  const timing = `${layoutTransition.duration}s cubic-bezier(${layoutTransition.ease.join(",")})`;

  return (
    <section
      className={`relative flex flex-1 flex-col ${isMobileDevice ? "min-w-0 w-full border-r-0" : "border-r border-gray-border"}`}
      style={{
        maxWidth: leftSectionAnimateMaxWidth,
        minWidth: leftSectionAnimateMinWidth,
        transition: `max-width ${timing}, min-width ${timing}`,
      }}
    >
      {children}
    </section>
  );
}
