"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { buildMobilePlanPanelHref, readMobilePlanPanel } from "@/lib/mobile-view";
import { SidebarChatUnreadBadge } from "@/components/layout/SidebarChatUnreadBadge";
import { cn } from "@/lib/utils";

const tabIcons = {
  schedule: "/icons/mobile/calendar.svg",
  bookmark: "/icons/mobile/bookmark.svg",
  tools: "/icons/mobile/travel-tools.svg",
  chat: "/icons/mobile/chat.svg",
} as const;

/** 모바일 전용 하단 탭 바 — 지도 전환은 상단 헤더에서 제공합니다. */
export function MobileMainTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobileDevice } = useMobileView();
  if (!isMobileDevice) return null;

  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  const currentPanel = readMobilePlanPanel(searchParams.get("view"));
  const tabs = [
    { label: "일정", href: buildMobilePlanPanelHref(pathname, "schedule"), icon: tabIcons.schedule, active: isPlan && currentPanel !== "chat" },
    { label: "북마크", href: "/bookmark", icon: tabIcons.bookmark, active: pathname === "/bookmark" || pathname.startsWith("/bookmark/") },
    { label: "여행 도구", href: "/cost", icon: tabIcons.tools, active: pathname === "/cost" || pathname.startsWith("/cost/") },
    { label: "채팅", href: buildMobilePlanPanelHref(pathname, "chat"), icon: tabIcons.chat, active: isPlan && currentPanel === "chat" },
  ];
  return (
    <nav aria-label="모바일 주요 메뉴" data-mobile-main-tabs className="shrink-0 bg-fill-subtle shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
      <div className="grid grid-cols-4 px-3">
        {tabs.map(({ label, href, icon, active }) => (
          <Link key={label} href={href} aria-label={label} aria-current={active ? "page" : undefined}
            className={cn("relative flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 pt-1 text-[11px] font-semibold leading-4 tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-primary", active ? "text-primary-strong" : "text-text-subtle")}>
            <span aria-hidden className={cn("block size-6 shrink-0", active ? "bg-primary-strong" : "bg-icon-subtle")} style={{ mask: `url('${icon}') center / contain no-repeat` }} />
            <span>{label}</span>
            {label === "채팅" ? <SidebarChatUnreadBadge /> : null}
          </Link>
        ))}
      </div>
      <div aria-hidden className="relative h-[max(34px,env(safe-area-inset-bottom))]">
        <span className="absolute bottom-2 left-1/2 h-[5px] w-36 -translate-x-1/2 rounded-full bg-border-default" />
      </div>
    </nav>
  );
}
