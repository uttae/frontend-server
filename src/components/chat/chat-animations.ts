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

/** 다른 페이지 위에 떠 있는 최소화 채팅 — 최대화는 `/chat` 페이지가 본문으로 그린다 */
export const minimizedPanelAnimate = {
  opacity: 1,
  scale: 1,
  y: 0,
  borderRadius: 16,
  boxShadow: "0 20px 40px -8px rgba(0,0,0,0.18)",
};

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
