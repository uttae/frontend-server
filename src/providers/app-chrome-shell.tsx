import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { CookieSettingsProvider } from "@/components/analytics/CookieSettingsProvider";
import { ConsentGatedAnalytics } from "@/components/analytics/ConsentGatedAnalytics";
import { MobileChrome } from "@/components/mobile/MobileChrome";
import { amplitudeRuntime } from "@/lib/analytics/amplitude-runtime";
import { analyticsRuntime } from "@/lib/analytics/runtime";

export function AppChromeShell({
  analytics,
  children,
}: {
  analytics: ReactNode;
  children: ReactNode;
}) {
  const gaId =
    analyticsRuntime.enabled && analyticsRuntime.measurementId
      ? analyticsRuntime.measurementId
      : "";
  const analyticsEnabled =
    analyticsRuntime.enabled || amplitudeRuntime.enabled;

  return (
    <CookieSettingsProvider>
      <MobileChrome>{children}</MobileChrome>
      {analyticsEnabled ? (
        <ConsentGatedAnalytics
          debugMode={analyticsRuntime.debugMode}
          gaId={gaId}
        >
          {analytics}
        </ConsentGatedAnalytics>
      ) : null}
      <Toaster position="bottom-right" richColors />
    </CookieSettingsProvider>
  );
}
