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
    { label: "가계부", href: "/cost", active: !isPacking },
    { label: "준비물", href: `/packing/${roomId}`, active: isPacking },
  ];

  return (
    <nav aria-label="여행 도구 선택" className="shrink-0 border-b border-border-subtle bg-background px-5">
      <div className="mx-auto flex max-w-[520px]">
        {links.map(({ label, href, active }) => (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-1 items-center justify-center border-b-2 text-[15px] font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
              active ? "border-primary text-primary-strong" : "border-transparent text-text-subtle hover:text-text",
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
