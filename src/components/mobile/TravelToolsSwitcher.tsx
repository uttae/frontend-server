"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { isPackingPath } from "@/lib/room-context-path";
import { cn } from "@/lib/utils";

export function TravelToolsSwitcher() {
  const pathname = usePathname();
  const { roomId } = useCurrentRoomId();
  if (!roomId) return null;

  const isPacking = isPackingPath(pathname);
  const links = [
    { label: "지출", href: "/cost", active: !isPacking },
    { label: "준비물", href: `/packing/${roomId}`, active: isPacking },
  ];

  return (
    <nav aria-label="여행 도구 선택" className="shrink-0 border-b border-border">
      <div className="flex">
        {links.map(({ label, href, active }) => (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center px-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
              active
                ? "text-label-l-emphasis text-primary-strong shadow-[inset_0_-2px_0_var(--color-primary-default)]"
                : "text-label-l-regular text-text-subtle shadow-[inset_0_-2px_0_var(--color-border-subtle)]",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
