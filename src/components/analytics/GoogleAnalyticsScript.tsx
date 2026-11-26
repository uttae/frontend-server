"use client";

import { useEffect } from "react";
import Script from "next/script";

import { initializeGoogleAnalytics } from "@/lib/analytics/client";

type GoogleAnalyticsScriptProps = {
  debugMode: boolean;
  gaId: string;
};

export function GoogleAnalyticsScript({ debugMode, gaId }: GoogleAnalyticsScriptProps) {
  useEffect(() => {
    initializeGoogleAnalytics(gaId, debugMode);
  }, [debugMode, gaId]);

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
      strategy="afterInteractive"
    />
  );
}
