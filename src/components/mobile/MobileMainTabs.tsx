"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, CalendarDays, MessageCircleMore, Search, Users } from "lucide-react";

import { useMobileView } from "@/contexts/MobileViewContext";
import { buildMobilePlanPanelHref, readMobilePlanPanel } from "@/lib/mobile-view";
import { SidebarChatUnreadBadge } from "@/components/layout/SidebarChatUnreadBadge";
import { cn } from "@/lib/utils";

/** 모바일 전용 하단 탭 바 — 지도 전환은 기존 플랜 패널 URL을 사용합니다. */
export function MobileMainTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobileDevice } = useMobileView();
  if (!isMobileDevice) return null;

  const isPlan = pathname === "/plan" || pathname.startsWith("/plan/");
  const currentPanel = readMobilePlanPanel(searchParams.get("view"));
  const tabs = [
    { label: "일정", href: buildMobilePlanPanelHref(pathname, "schedule"), icon: CalendarDays, active: isPlan && currentPanel !== "chat" },
    { label: "검색", href: "/search", icon: Search, active: pathname === "/search" || pathname.startsWith("/search/") },
    { label: "북마크", href: "/bookmark", icon: Bookmark, active: pathname === "/bookmark" || pathname.startsWith("/bookmark/") },
    { label: "채팅", href: buildMobilePlanPanelHref(pathname, "chat"), icon: MessageCircleMore, active: isPlan && currentPanel === "chat" },
    { label: "멤버", href: "/member-settings", icon: Users, active: pathname === "/member-settings" || pathname.startsWith("/member-settings/") },
  ];
  return (
    <nav aria-label="모바일 주요 메뉴" className="grid shrink-0 grid-cols-5 border-t border-gray-border bg-white pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ label, href, icon: Icon, active }) => (
        <Link key={label} href={href} aria-label={label} aria-current={active ? "page" : undefined}
          className={cn("relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-2 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary", active ? "text-primary" : "text-dark-gray hover:text-gray-900")}>
          <Icon size={20} aria-hidden />
          <span>{label}</span>
          {label === "채팅" ? <SidebarChatUnreadBadge /> : null}
        </Link>
      ))}
    </nav>
  );
}
