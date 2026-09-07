"use client";

import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { PrivacySettingsLink } from "@/components/analytics/PrivacySettingsLink";
import { useChat } from "@/hooks/useChat";
import { useHostJoinRequestsBadgeCount } from "@/hooks/useHostJoinRequestsBadgeCount";
import { sidebarIcons } from "@/lib/public-assets";

import { SidebarChatUnreadBadge } from "./SidebarChatUnreadBadge";
import { SidebarContactButton } from "./SidebarContactButton";
import { SidebarFeedbackFormButton } from "./SidebarFeedbackFormButton";
import { SidebarNavItem } from "./SidebarNavItem";
import { sidebarNavButtonClassName } from "./sidebarNavButton";

const SIDEBAR_ITEMS = [
  { key: "search", href: "/search", icon: sidebarIcons.search },
  { key: "plan", href: "/plan", icon: sidebarIcons.plan },
  { key: "bookmark", href: "/bookmark", icon: sidebarIcons.bookmark },
  {
    key: "member-settings",
    href: "/member-settings",
    icon: sidebarIcons.memberSettings,
  },
  {
    key: "room-settings",
    href: "/room-settings",
    icon: sidebarIcons.roomSettings,
  },
] as const;

function isSidebarItemActive(pathname: string, key: string, href: string) {
  if (key === "plan") {
    return pathname === "/plan" || pathname.startsWith("/plan/");
  }
  return pathname.startsWith(href);
}

function SideBar() {
  const pathname = usePathname();
  const { chatState, openChat } = useChat();
  const pendingJoinRequestsCount = useHostJoinRequestsBadgeCount();

  const isChatActive = chatState !== "closed";
  const isOnMemberSettings = pathname.startsWith("/member-settings");
  const isOnRoomSettings = pathname.startsWith("/room-settings");
  const isOnSettingsArea = isOnMemberSettings || isOnRoomSettings;
  const showSettingsNotification =
    pendingJoinRequestsCount > 0 && !isOnSettingsArea;

  return (
    <aside className="flex h-full w-13 shrink-0 flex-col items-center gap-2 border-r border-gray-border bg-white">
      <button
        onClick={openChat}
        className={`relative flex w-20 cursor-pointer items-center justify-center rounded-br-2xl py-2 transition hover:opacity-80 ${
          isChatActive ? "bg-primary/80" : "bg-primary"
        }`}
        aria-label="sidebar-chat"
        data-tutorial-target="chat"
      >
        <img src={sidebarIcons.chat} alt="" className="h-9 w-9 brightness-0 invert" />
        <SidebarChatUnreadBadge />
      </button>

      <div className="flex flex-col items-center gap-2 px-1">
      {SIDEBAR_ITEMS.map((item) => (
        <SidebarNavItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={`sidebar-${item.href.slice(1)}`}
          tutorialTarget={item.key}
          isActive={isSidebarItemActive(pathname, item.key, item.href)}
          showPingBadge={
            item.key === "member-settings" && showSettingsNotification
          }
          showDividerBelow={item.key === "bookmark"}
        />
      ))}

      </div>

      <div className="mt-auto flex flex-col items-center gap-2 px-1 pb-4">
        <PrivacySettingsLink
          className={sidebarNavButtonClassName()}
          aria-label="sidebar-privacy-settings"
        >
          <ShieldCheck
            className="h-6 w-6 text-dark-gray"
            strokeWidth={2}
            aria-hidden
          />
        </PrivacySettingsLink>
        <SidebarFeedbackFormButton />
        <SidebarContactButton />
      </div>
    </aside>
  );
}

export default SideBar;
