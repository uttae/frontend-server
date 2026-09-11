"use client";

import { usePathname } from "next/navigation";

import { useChat } from "@/hooks/useChat";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { sidebarIcons } from "@/lib/public-assets";

import { SidebarChatUnreadBadge } from "./SidebarChatUnreadBadge";
import { SidebarFeedbackFormButton } from "./SidebarFeedbackFormButton";
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
    <aside className="flex h-full w-20 shrink-0 flex-col items-center gap-2 border-r border-gray-border bg-white py-2">
      <nav aria-label="여행 주요 메뉴" className="flex w-full flex-col items-center gap-2 px-1">
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
          {/* eslint-disable-next-line @next/next/no-img-element -- existing local navigation asset */}
          <img src={sidebarIcons.chat} alt="" className="h-6 w-6" />
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
      <div className="mt-auto flex flex-col items-center gap-2 px-1 pb-4">
        <SidebarFeedbackFormButton />
      </div>
    </aside>
  );
}

export default SideBar;
