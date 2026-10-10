"use client";

import { motion } from "framer-motion";

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

  return (
    <motion.section
      className={`relative flex flex-1 flex-col ${isMobileDevice ? "min-w-0 w-full border-r-0" : "border-r border-gray-border"}`}
      initial={false}
      // CSS applies `none` directly while interpolating numeric widths, without remounting the page.
      style={{
        maxWidth: leftSectionAnimateMaxWidth,
        transition: `max-width ${layoutTransition.duration}s cubic-bezier(${layoutTransition.ease.join(",")})`,
      }}
      animate={{
        minWidth: leftSectionAnimateMinWidth,
      }}
      transition={layoutTransition}
    >
      {children}
    </motion.section>
  );
}
