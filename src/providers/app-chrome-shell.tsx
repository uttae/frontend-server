import type { ReactNode } from "react";

import { AppToaster } from "@/components/AppToaster";
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
      {/* Base UI 권장: 앱을 별도 쌓임 맥락으로 묶어 body로 포털되는 대화상자·팝업이 늘 앱 위에 뜨게 한다.
          토스트는 이 밖에 두어 대화상자가 열려 있어도 위에 보인다 */}
      <div className="isolate flex min-h-full w-full flex-1 flex-col">
        <MobileChrome>{children}</MobileChrome>
      </div>
      {analyticsEnabled ? (
        <ConsentGatedAnalytics
          debugMode={analyticsRuntime.debugMode}
          gaId={gaId}
        >
          {analytics}
        </ConsentGatedAnalytics>
      ) : null}
      <AppToaster />
    </CookieSettingsProvider>
  );
}
