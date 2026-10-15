"use client";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useMainChromeLayoutWidth } from "@/contexts/MainChromeLayoutWidthContext";

export default function LeftSection({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isMobileDevice } = useMobileView();
  const {
    leftSectionAnimateMaxWidth,
    leftSectionAnimateMinWidth,
    layoutTransition,
  } = useMainChromeLayoutWidth();
  const timing = `${layoutTransition.duration}s cubic-bezier(${layoutTransition.ease.join(",")})`;

  return (
    <section
      className={`relative flex flex-1 flex-col ${isMobileDevice ? "min-w-0 w-full border-r-0" : "border-r border-gray-border"}`}
      // CSS applies `none` directly while interpolating numeric widths, without remounting the page.
      // 최소 폭도 CSS로 넣는다 — framer `animate`로 넣었을 때 준비물(최소 0)에 들렀다 오면 다시 커지지 않았다.
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
