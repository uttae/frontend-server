import type { Metadata } from "next";

import { MainRoomGate } from "@/components/layout/MainRoomGate";
import { MainLayoutChrome } from "@/components/layout/MainLayoutChrome";
import { NOINDEX_NOFOLLOW_METADATA } from "@/lib/public-site-metadata";
import { MainChromeProviders } from "@/providers/main-providers";

export const metadata: Metadata = NOINDEX_NOFOLLOW_METADATA;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainChromeProviders>
      <MainRoomGate>
        <MainLayoutChrome>{children}</MainLayoutChrome>
      </MainRoomGate>
    </MainChromeProviders>
  );
}
