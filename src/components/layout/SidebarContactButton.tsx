"use client";

import Link from "next/link";

import { sidebarWireframeIcons } from "@/lib/public-assets";

import { sidebarNavButtonClassName } from "./sidebarNavButton";
import { SidebarIcon } from "./SidebarIcon";

export function SidebarContactButton() {
  return (
    <Link
      href="https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header"
      className={sidebarNavButtonClassName(false)}
      aria-label="버그 제보"
      title="버그 제보"
    >
      <SidebarIcon src={sidebarWireframeIcons.bug} />
      <span>버그 제보</span>
    </Link>
  );
}
