import { cn } from "@/lib/utils";

export function sidebarNavButtonClassName(isActive = false) {
  return cn(
    "flex h-[92px] w-full shrink-0 cursor-pointer flex-col items-center justify-start gap-[7px] pt-4 pb-[13px] text-[14px] leading-5 font-bold tracking-[-0.02em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-strong",
    isActive ? "bg-primary text-icon-inverse" : "bg-transparent text-text-subtle hover:bg-fill-subtle",
  );
}
