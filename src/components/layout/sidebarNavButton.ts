import { cn } from "@/lib/utils";

export function sidebarNavButtonClassName(isActive = false) {
  return cn(
    "flex h-[68px] w-full shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 pt-0.5 text-[12px] leading-4 tracking-[-0.02em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-strong",
    isActive ? "bg-primary font-bold text-text-inverse" : "bg-transparent font-medium text-text hover:bg-fill-subtle",
  );
}
