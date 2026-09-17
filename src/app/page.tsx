import type { Metadata } from "next";
import { Suspense } from "react";
import { CookieSettingsLandingEntry } from "@/components/analytics/CookieSettingsProvider";

import { LandingView } from "@/app/_components/LandingView";
import { StructuredData } from "@/components/seo/StructuredData";
import {
  ORGANIZATION_JSON_LD,
  publicPageMetadata,
  SOFTWARE_APPLICATION_JSON_LD,
} from "@/lib/public-site-metadata";

export const metadata: Metadata = publicPageMetadata("/");

export default function RootPage() {
  return (
    <>
      <StructuredData id="uttae-organization" data={ORGANIZATION_JSON_LD} />
      <StructuredData
        id="uttae-software-application"
        data={SOFTWARE_APPLICATION_JSON_LD}
      />
      <LandingView />
      <Suspense fallback={null}><CookieSettingsLandingEntry /></Suspense>
    </>
  );
}
