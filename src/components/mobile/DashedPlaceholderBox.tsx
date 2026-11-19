import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DashedBorder({ active = false, className }: Readonly<{ active?: boolean; className?: string }>) {
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}>
      <rect
        width="100%"
        height="100%"
        rx="6"
        fill="none"
        strokeWidth="1"
        strokeDasharray="8 6"
        className={cn("transition-colors", active ? "stroke-primary" : "stroke-border")}
      />
    </svg>
  );
}

export function DashedPlaceholderBox({
  active = false,
  className,
  children,
}: Readonly<{ active?: boolean; className?: string; children: ReactNode }>) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-md transition-colors",
        active && "bg-[var(--blue-50)]",
        className,
      )}
    >
      <DashedBorder active={active} />
      {children}
    </div>
  );
}
