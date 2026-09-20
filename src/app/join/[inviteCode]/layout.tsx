import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NOINDEX_NOFOLLOW_METADATA } from "@/lib/public-site-metadata";
import { inviteShareMetadata } from "@/lib/share-metadata";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  ...NOINDEX_NOFOLLOW_METADATA,
  metadataBase: new URL(SITE_URL),
  title: inviteShareMetadata.title,
  description: inviteShareMetadata.description,
  openGraph: {
    type: "website",
    siteName: "우때",
    title: inviteShareMetadata.title,
    description: inviteShareMetadata.description,
    images: [
      {
        url: inviteShareMetadata.imagePath,
        width: inviteShareMetadata.imageWidth,
        height: inviteShareMetadata.imageHeight,
        alt: "우때",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: inviteShareMetadata.title,
    description: inviteShareMetadata.description,
    images: [inviteShareMetadata.imagePath],
  },
};

export default function JoinInviteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
