import { cn } from "@/lib/utils";

/** `className`으로 위치를 덮어쓸 수 있다 — 예: 헤더 아바타 우상단 */
export function SidebarPingBadge({ className }: Readonly<{ className?: string }>) {
  return (
    <span className={cn("pointer-events-none absolute right-[18px] top-2.5 flex h-3.5 w-3.5 items-center justify-center", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
  );
}
