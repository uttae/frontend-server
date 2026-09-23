import type { Transition, Variants } from "framer-motion";

const PANEL_SPRING: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 12 },
};

export const panelTransition: Transition = {
  layout: PANEL_SPRING,
  opacity: { duration: 0.2 },
  scale: { duration: 0.2 },
  y: { duration: 0.2 },
  borderRadius: PANEL_SPRING,
  boxShadow: { duration: 0.25 },
};

export function getPanelAnimate(isMinimized: boolean) {
  return {
    opacity: 1,
    scale: 1,
    y: 0,
    borderRadius: isMinimized ? 16 : 0,
    boxShadow: isMinimized
      ? "0 20px 40px -8px rgba(0,0,0,0.18)"
      : "0 0 0 0 rgba(0,0,0,0)",
  };
}

export const chatTapSoft = { scale: 0.96 };
export const chatTapTransition = {
  type: "spring",
  stiffness: 500,
  damping: 28,
} as const;

export const chatAiLabelMotion = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -6 },
  transition: { duration: 0.18, ease: [0.25, 0.1, 0.25, 1] } as Transition,
};
