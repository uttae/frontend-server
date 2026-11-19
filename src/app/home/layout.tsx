import type { Metadata } from "next";

import { NOINDEX_NOFOLLOW_METADATA } from "@/lib/public-site-metadata";

import { HomeSessionSync } from "./_components/HomeSessionSync";

export const metadata: Metadata = NOINDEX_NOFOLLOW_METADATA;

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <HomeSessionSync>{children}</HomeSessionSync>;
}
