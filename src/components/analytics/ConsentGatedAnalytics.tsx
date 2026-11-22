"use client";

import type { ReactNode } from "react";
import { useCallback, useSyncExternalStore } from "react";

import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";
import { GoogleAnalyticsScript } from "@/components/analytics/GoogleAnalyticsScript";
import { denyAnalyticsConsent, grantAnalyticsConsent } from "@/lib/analytics/consent-actions";
import { analyticsConsentStore } from "@/lib/analytics/consent-store";

import { AmplitudeAnalytics } from "@/components/analytics/AmplitudeAnalytics";
type ConsentGatedAnalyticsProps = {
  children: ReactNode;
  debugMode: boolean;
  gaId: string;
};

export function ConsentGatedAnalytics({ children, debugMode, gaId }: Readonly<ConsentGatedAnalyticsProps>) {
  const consent = useSyncExternalStore(
    analyticsConsentStore.subscribe,
    analyticsConsentStore.getSnapshot,
    analyticsConsentStore.getServerSnapshot,
  );

  const handleAccept = useCallback(() => {
    grantAnalyticsConsent();
  }, []);

  const handleReject = useCallback(() => {
    denyAnalyticsConsent();
  }, []);

  return (
    <>
      {consent === "pending" ? <CookieConsentBanner onAccept={handleAccept} onReject={handleReject} /> : null}
      {consent === "granted" ? (
        <>
          <AmplitudeAnalytics />
          {gaId ? <GoogleAnalyticsScript debugMode={debugMode} gaId={gaId} /> : null}
          {children}
        </>
      ) : null}
    </>
  );
}
