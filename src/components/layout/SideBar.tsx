"use client";

import { usePathname } from "next/navigation";

import { useChat } from "@/hooks/useChat";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { sidebarWireframeIcons as sidebarIcons } from "@/lib/public-assets";
import { MAIN_SIDEBAR_RAIL_WIDTH } from "@/lib/layout-tokens";

import { SidebarChatUnreadBadge } from "./SidebarChatUnreadBadge";
import { SidebarFeedbackFormButton } from "./SidebarFeedbackFormButton";
import { SidebarContactButton } from "./SidebarContactButton";
import { SidebarIcon } from "./SidebarIcon";
import { SidebarNavItem } from "./SidebarNavItem";
import { sidebarNavButtonClassName } from "./sidebarNavButton";

const SIDEBAR_ITEMS = [
  { key: "plan", href: "/plan", label: "일정", icon: sidebarIcons.plan },
  { key: "search", href: "/search", label: "검색", icon: sidebarIcons.search },
  { key: "bookmark", href: "/bookmark", label: "북마크", icon: sidebarIcons.bookmark },
] as const;

function isSidebarItemActive(pathname: string, key: string, href: string) {
  if (key === "plan") {
    return pathname === "/plan" || pathname.startsWith("/plan/");
  }
  return pathname.startsWith(href);
}

function SideBar() {
  const pathname = usePathname();
  const { chatState, openChat, closeChat } = useChat();
  const pendingJoinRequestsCount = useHostJoinRequestsBadgeCount();

  const isChatActive = chatState !== "closed";
  const isOnMemberSettings = pathname.startsWith("/member-settings");
  const isOnRoomSettings = pathname.startsWith("/room-settings");
  const isOnSettingsArea = isOnMemberSettings || isOnRoomSettings;
  const showSettingsNotification =
    pendingJoinRequestsCount > 0 && !isOnSettingsArea;

  return (
    <aside
      className="flex h-full shrink-0 flex-col items-center overflow-y-auto border-r border-border-subtle bg-background [scrollbar-gutter:auto] [scrollbar-width:thin]"
      style={{ width: MAIN_SIDEBAR_RAIL_WIDTH }}
    >
      <nav aria-label="여행 주요 메뉴" className="flex w-full shrink-0 flex-col items-center [&>div:first-child>a]:h-[90px] [&>div:first-child>a]:pt-5">
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            tutorialTarget={item.key}
            isActive={!isChatActive && isSidebarItemActive(pathname, item.key, item.href)}
            onClick={closeChat}
            showDividerBelow={item.key === "bookmark"}
          />
        ))}
        <button
          type="button"
          onClick={openChat}
          className={`relative ${sidebarNavButtonClassName(isChatActive)}`}
          aria-label="채팅"
          aria-pressed={isChatActive}
          data-tutorial-target="chat"
        >
          <SidebarIcon src={sidebarIcons.chat} isActive={isChatActive} />
          <span>채팅</span>
          <SidebarChatUnreadBadge />
        </button>
        <SidebarNavItem
          href="/member-settings"
          icon={sidebarIcons.memberSettings}
          label="멤버"
          tutorialTarget="member-settings"
          isActive={!isChatActive && isOnMemberSettings}
          onClick={closeChat}
          showPingBadge={showSettingsNotification}
        />
      </nav>
      <div className="mt-auto flex w-full shrink-0 flex-col items-center pt-4">
        <SidebarFeedbackFormButton />
        <SidebarContactButton />
      </div>
    </aside>
  );
}

export default SideBar;
