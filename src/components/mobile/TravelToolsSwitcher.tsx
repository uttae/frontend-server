"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { isPackingPath } from "@/lib/room-context-path";
import { cn } from "@/lib/utils";

// 링크 이동이라 ui Tabs 대신 같은 모양(Tabs Line md, Figma 6388:16199)을 직접 그린다.
// 막대 2px는 높이를 차지하지 않게 안쪽 그림자로, 상단 아래 선 1px는 그 밑에 nav 테두리로 둔다(Figma Top 테두리가 바깥쪽)
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
