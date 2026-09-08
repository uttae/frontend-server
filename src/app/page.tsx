import type { Metadata } from "next";

import { LandingView } from "@/app/_components/LandingView";
import { StructuredData } from "@/components/seo/StructuredData";
import { brandAssets } from "@/lib/public-assets";
import {
  ORGANIZATION_JSON_LD,
  publicPageMetadata,
  SOFTWARE_APPLICATION_JSON_LD,
} from "@/lib/public-site-metadata";

const publicMetadata = publicPageMetadata("/");
const { title, description } = publicMetadata;

export const metadata: Metadata = {
  ...publicMetadata,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "우때",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: brandAssets.shareImage,
        width: 1200,
        height: 1200,
        alt: "우때",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [brandAssets.shareImage],
  },
};

export default function RootPage() {
  return (
    <>
      <StructuredData id="uttae-organization" data={ORGANIZATION_JSON_LD} />
      <StructuredData id="uttae-software-application" data={SOFTWARE_APPLICATION_JSON_LD} />
      <LandingView />
    </>
  );
}
