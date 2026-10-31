import { cn } from "@/lib/utils";

// FilterDropdown 트리거 전용이다. Dropdown 단계에서 ui 부품으로 옮기기 전까지 같은 줄의 Chip(outline md)과 같은 값으로 둔다.
// 값을 고른 모양은 트리거에 aria-pressed가 없어 Chip이 그리지 못하므로 active로 테두리·글자 색을 준다.
const mapChipButtonBaseClass =
  "inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full border bg-fill-subtle px-4 text-label-m-emphasis transition-colors duration-120 ease-out active:bg-fill-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

export function mapChipButtonClassName(active: boolean) {
  return cn(mapChipButtonBaseClass, active ? "border-primary-strong text-primary-strong" : "border-border text-text");
}
