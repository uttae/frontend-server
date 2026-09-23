import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";

import { HomeHeader } from "../_components/HomeHeader";

export default function HomeWithHeaderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-fill-subtle">
      <HomeHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter variant="room-list" />
    </div>
  );
}
