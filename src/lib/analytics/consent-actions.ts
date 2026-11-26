import { revokeGoogleAnalyticsConsent } from "@/lib/analytics/client";
import { clearGoogleAnalyticsCookies, type AnalyticsConsentValue } from "@/lib/analytics/consent-cookie";
import { analyticsConsentStore, type AnalyticsConsentUpdateResult } from "@/lib/analytics/consent-store";

type AnalyticsConsentActionDependencies = {
  clearCookies: () => void;
  revokeGoogleAnalytics: () => void;
  setConsent: (value: AnalyticsConsentValue) => AnalyticsConsentUpdateResult;
};

export function createAnalyticsConsentActions(dependencies: AnalyticsConsentActionDependencies) {
  return {
    grant: () => dependencies.setConsent("granted"),
    deny: () => {
      dependencies.revokeGoogleAnalytics();
      const result = dependencies.setConsent("denied");
      dependencies.clearCookies();
      return result;
    },
  };
}

const analyticsConsentActions = createAnalyticsConsentActions({
  clearCookies: clearGoogleAnalyticsCookies,
  revokeGoogleAnalytics: revokeGoogleAnalyticsConsent,
  setConsent: analyticsConsentStore.set,
});

export const grantAnalyticsConsent = analyticsConsentActions.grant;
export const denyAnalyticsConsent = analyticsConsentActions.deny;
