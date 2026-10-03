import { cn } from "@/lib/utils";

export function sidebarNavButtonClassName(isActive = false) {
  return cn(
    "flex h-[68px] w-full shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 pt-0.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-strong",
    isActive ? "bg-primary text-label-xs-emphasis text-text-inverse" : "bg-transparent text-label-xs-regular text-text hover:bg-fill active:bg-fill-strong",
  );
}
