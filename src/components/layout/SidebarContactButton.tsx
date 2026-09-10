"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sidebarIcons } from "@/lib/public-assets";

import { sidebarNavButtonClassName } from "./sidebarNavButton";

export function SidebarContactButton() {
  const pathname = usePathname();
  const isActive = pathname.startsWith("/contact");

  return (
    <Link
      href="https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header"
      className={sidebarNavButtonClassName(isActive)}
      aria-label="버그 제보"
      title="버그 제보"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- exact local Figma SVG, no image optimization needed */}
      <img
        src={sidebarIcons.bug}
        alt=""
        width={24}
        height={24}
        className="h-6 w-6"
      />
    </Link>
  );
}
