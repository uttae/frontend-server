import { cn } from "@/lib/utils";

const mapChipButtonBaseClass =
  "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border bg-fill-elevate px-4 text-label-m-emphasis shadow-[0_2px_10px_#0000001a] transition-colors hover:bg-fill active:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function mapFilterChipInactiveClassName() {
  return cn(mapChipButtonBaseClass, "border-border text-text");
}

export function mapFilterChipActiveRingClassName() {
  return cn(mapChipButtonBaseClass, "border-primary-strong text-primary-strong");
}

export function mapFilterChipActiveFilledClassName() {
  return mapFilterChipActiveRingClassName();
}

/** Chip / Outline / md, including the selected category. */
export function mapChipButtonClassName(active: boolean) {
  return active ? mapFilterChipActiveRingClassName() : mapFilterChipInactiveClassName();
}
