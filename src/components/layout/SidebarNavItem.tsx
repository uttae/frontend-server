import Link from "next/link";

import { SidebarPingBadge } from "./SidebarPingBadge";
import { sidebarNavButtonClassName } from "./sidebarNavButton";
import { SidebarIcon } from "./SidebarIcon";

type SidebarNavItemProps = {
  href: string;
  icon: string;
  label: string;
  tutorialTarget: string;
  isActive: boolean;
  onClick?: () => void;
  showPingBadge?: boolean;
  showDividerBelow?: boolean;
};

export function SidebarNavItem({
  href,
  icon,
  label,
  tutorialTarget,
  isActive,
  onClick,
  showPingBadge = false,
  showDividerBelow = false,
}: SidebarNavItemProps) {
  return (
    <div className="relative w-full">
      <Link
        href={href}
        className={sidebarNavButtonClassName(isActive)}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
        data-tutorial-target={tutorialTarget}
      >
        <SidebarIcon src={icon} isActive={isActive} />
        <span>{label}</span>
      </Link>

      {showPingBadge ? <SidebarPingBadge /> : null}

      {showDividerBelow ? (
        <div className="w-full border-t border-border-subtle" />
      ) : null}
    </div>
  );
}
