import { cn } from "@/lib/utils";

export function sidebarNavButtonClassName(isActive = false) {
  return cn(
    "flex cursor-pointer min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl text-[12px] font-medium text-dark-gray transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    isActive ? "bg-light-gray text-primary" : "bg-transparent hover:bg-light-gray",
  );
}
