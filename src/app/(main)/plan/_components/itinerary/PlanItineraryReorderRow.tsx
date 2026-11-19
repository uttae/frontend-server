"use client";

import type { CSSProperties, ReactNode, Ref } from "react";

export type PlanItineraryReorderRowProps = {
  rowRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  children: ReactNode;
};

export function PlanItineraryReorderRow({
  rowRef,
  style,
  children,
}: PlanItineraryReorderRowProps) {
  return (
    <div ref={rowRef} style={style}>
      {children}
    </div>
  );
}
