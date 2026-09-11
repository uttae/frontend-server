"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sidebarWireframeIcons } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

import { sidebarNavButtonClassName } from "./sidebarNavButton";
import { SidebarIcon } from "./SidebarIcon";

export function SidebarContactButton() {
  const pathname = usePathname();
  const isActive = pathname.startsWith("/contact");

  return (
    <Link
      href="https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header"
      className={cn(sidebarNavButtonClassName(isActive), "font-normal tracking-normal", !isActive && "text-text")}
      aria-label="버그 제보"
      title="버그 제보"
    >
      <SidebarIcon src={sidebarWireframeIcons.bug} isActive={isActive} />
      <span>버그제보</span>
    </Link>
  );
}
