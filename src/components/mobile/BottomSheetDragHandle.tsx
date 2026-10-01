"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { useSheetDrag } from "./useSheetDrag";

/** Shared gesture surface; form controls and the scrolling body stay outside it. */
export function BottomSheetDragHandle({ drag, className, children }: Readonly<{
  drag: ReturnType<typeof useSheetDrag>;
  className?: string;
  children: ReactNode;
}>) {
  return <div {...drag.handleProps} className={cn(drag.handleClassName, className)}>{children}</div>;
}
