import {
  readAnalyticsConsentCookie,
  writeAnalyticsConsentCookie,
  type AnalyticsConsent,
  type AnalyticsConsentValue,
} from "@/lib/analytics/consent-cookie";

export type AnalyticsConsentState = AnalyticsConsentValue | "pending";
export type AnalyticsConsentUpdateResult = {
  persisted: boolean;
  state: AnalyticsConsentValue;
};

type ConsentCookiePort = {
  read: () => AnalyticsConsent;
  write: (value: AnalyticsConsentValue) => boolean;
};

export type AnalyticsConsentStore = {
  getServerSnapshot: () => AnalyticsConsentState;
  getSnapshot: () => AnalyticsConsentState;
  isGranted: () => boolean;
  set: (value: AnalyticsConsentValue) => AnalyticsConsentUpdateResult;
  subscribe: (listener: () => void) => () => void;
};

export function createAnalyticsConsentStore(port: ConsentCookiePort): AnalyticsConsentStore {
  const listeners = new Set<() => void>();
  let sessionState: AnalyticsConsentValue | null = null;

  const getSnapshot = (): AnalyticsConsentState => sessionState ?? port.read() ?? "pending";

  return {
    getServerSnapshot: () => "pending",
    getSnapshot,
    isGranted: () => getSnapshot() === "granted",
    set: (value) => {
      sessionState = value;
      const persisted = port.write(value);
      listeners.forEach((listener) => listener());
      return { persisted, state: value };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const analyticsConsentStore = createAnalyticsConsentStore({
  read: readAnalyticsConsentCookie,
  write: writeAnalyticsConsentCookie,
});
