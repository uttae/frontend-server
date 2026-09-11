import Link from "next/link";

import { SidebarPingBadge } from "./SidebarPingBadge";
import { sidebarNavButtonClassName } from "./sidebarNavButton";

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
    <div className="relative">
      <Link
        href={href}
        className={sidebarNavButtonClassName(isActive)}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={onClick}
        data-tutorial-target={tutorialTarget}
      >
        <img src={icon} alt="" className="h-6 w-6" />
        <span>{label}</span>
      </Link>

      {showPingBadge ? <SidebarPingBadge /> : null}

      {showDividerBelow ? (
        <div className="mt-2 w-10 border-t border-gray-border" />
      ) : null}
    </div>
  );
}
