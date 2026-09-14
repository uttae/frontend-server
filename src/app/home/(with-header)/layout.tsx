import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { MobileReadOnlyNotice } from "@/components/mobile/MobileReadOnlyNotice";

import { HomeHeader } from "../_components/HomeHeader";

export default function HomeWithHeaderLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MobileReadOnlyNotice />
      <HomeHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}
