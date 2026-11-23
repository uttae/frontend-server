import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX_NOFOLLOW_METADATA } from "@/lib/public-site-metadata";

export const metadata: Metadata = NOINDEX_NOFOLLOW_METADATA;

export default function AuthCallbackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
