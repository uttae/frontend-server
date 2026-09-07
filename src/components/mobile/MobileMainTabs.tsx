"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import {
  buildMobilePlanPanelHref,
  MOBILE_PLAN_PANEL_ORDER,
  readMobilePlanPanel,
  type MobilePlanPanel,
} from "@/lib/mobile-view";
import { cn } from "@/lib/utils";

type MobileTab = {
  label: string;
  href: string;
  matchPrefix: string;
  panel?: MobilePlanPanel;
};

const STATIC_TABS: readonly MobileTab[] = [
  { label: "북마크", href: "/bookmark", matchPrefix: "/bookmark" },
  { label: "멤버", href: "/member-settings", matchPrefix: "/member-settings" },
  { label: "방설정", href: "/room-settings", matchPrefix: "/room-settings" },
];

const PLAN_PANEL_LABELS: Record<MobilePlanPanel, string> = {
  chat: "채팅",
  schedule: "일정",
  map: "지도",
};

function isTabActive(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** 모바일 전용 상단 탭 바 — 데스크톱에서는 사이드바 사용 */
export function MobileMainTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobileDevice } = useMobileView();

  if (!isMobileDevice) return null;

  const currentPanel = readMobilePlanPanel(searchParams.get("view"));
  const planTabs: readonly MobileTab[] = MOBILE_PLAN_PANEL_ORDER.map(
    (panel) => ({
      label: PLAN_PANEL_LABELS[panel],
      href: buildMobilePlanPanelHref(pathname, panel),
      matchPrefix: "/plan",
      panel,
    }),
  );
  const tabs = [...planTabs, ...STATIC_TABS];

  return (
    <nav
      aria-label="모바일 주요 메뉴"
      className="flex shrink-0 border-b border-gray-border bg-white"
    >
      {tabs.map((tab) => {
        const active =
          tab.panel != null
            ? isTabActive(pathname, tab.matchPrefix) &&
              currentPanel === tab.panel
            : isTabActive(pathname, tab.matchPrefix);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 items-center justify-center py-3 text-[14px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-dark-gray hover:text-gray-900",
            )}
          >
            {tab.label}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
