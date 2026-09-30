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
    setLeftSectionRef,
    leftSectionAnimateMaxWidth,
    leftSectionAnimateMinWidth,
    layoutTransition,
  } = useMainChromeLayoutWidth();

  return (
    <motion.section
      key={leftSectionAnimateMaxWidth === "none" ? "unbounded" : "bounded"}
      ref={setLeftSectionRef}
      className={`relative flex flex-1 flex-col ${isMobileDevice ? "min-w-0 w-full border-r-0" : "border-r border-gray-border"}`}
      initial={false}
      animate={{
        maxWidth: leftSectionAnimateMaxWidth,
        minWidth: leftSectionAnimateMinWidth,
      }}
      transition={layoutTransition}
    >
      {children}
    </motion.section>
  );
}
