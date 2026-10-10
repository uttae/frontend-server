import type { AnalyticsPageViewParams } from "@/lib/analytics/context";
import { analyticsConsentStore } from "@/lib/analytics/consent-store";
import { analyticsRuntime } from "@/lib/analytics/runtime";
import { getAnalyticsEventDestination } from "@/lib/analytics/event-destinations";

import {
  revokeAmplitudeConsent,
  sendAmplitudeDataCommand,
} from "@/lib/analytics/amplitude";
type GoogleAnalyticsConfig = {
  debug_mode?: true;
  send_page_view: false;
};

type GoogleTag = (...args: unknown[]) => void;

type GoogleConsentValue = "granted" | "denied";

type GoogleAnalyticsConsentState = {
  ad_personalization: "denied";
  ad_storage: "denied";
  ad_user_data: "denied";
  analytics_storage: GoogleConsentValue;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleTag;
  }
}

let initializedConfiguration: string | null = null;
let consentDefaultSent = false;
let analyticsTransportReady = false;
const pendingAnalyticsCommands: unknown[][] = [];

export function buildGoogleAnalyticsConfig(
  debugMode: boolean,
): GoogleAnalyticsConfig {
  return {
    send_page_view: false,
    ...(debugMode ? { debug_mode: true } : {}),
  };
}

export function buildGoogleAnalyticsConsentState(
  analyticsStorage: GoogleConsentValue,
): GoogleAnalyticsConsentState {
  return {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: analyticsStorage,
  };
}

function ensureGoogleTag(): GoogleTag | null {
  if (typeof window === "undefined") return null;

  window.dataLayer ??= [];
  window.gtag ??= function gtag() {
    // gtag.js는 Array가 아닌 함수의 native Arguments 객체를 명령으로 읽는다.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  return window.gtag;
}

export function sendAnalyticsDataCommand(...args: unknown[]): void {
  if (!analyticsConsentStore.isGranted()) return;

  const destination = args[0] === "event"
    ? getAnalyticsEventDestination(args[1])
    : "both";
  if (!destination) return;

  if (destination !== "ga4") {
    try {
      sendAmplitudeDataCommand(...args);
    } catch {
      // Analytics must never fail a completed user action or the other sink.
    }
  }

  if (destination === "amplitude" || !analyticsRuntime.enabled) return;

  if (!analyticsTransportReady) {
    pendingAnalyticsCommands.push(args);
    return;
  }

  sendGoogleAnalyticsDataCommand(...args);
}

function sendGoogleAnalyticsDataCommand(...args: unknown[]): void {
  try {
    ensureGoogleTag()?.(...args);
  } catch {
    // A blocked/broken tag must not interrupt the application or queue drain.
  }
}

function sendInitializationCommand(...args: unknown[]): void {
  ensureGoogleTag()?.(...args);
}

function openAnalyticsTransport(): void {
  analyticsTransportReady = true;
  for (const command of pendingAnalyticsCommands.splice(0)) {
    // Routing happened before enqueueing; this queue is GA-only.
    if (analyticsConsentStore.isGranted() && analyticsRuntime.enabled) {
      sendGoogleAnalyticsDataCommand(...command);
    }
  }
}

export function initializeGoogleAnalytics(
  measurementId: string,
  debugMode: boolean,
): void {
  if (!consentDefaultSent) {
    sendInitializationCommand(
      "consent",
      "default",
      buildGoogleAnalyticsConsentState("denied"),
    );
    consentDefaultSent = true;
  }

  sendInitializationCommand(
    "consent",
    "update",
    buildGoogleAnalyticsConsentState("granted"),
  );

  const configuration = `${measurementId}:${debugMode}`;
  if (initializedConfiguration === configuration) {
    openAnalyticsTransport();
    return;
  }

  sendInitializationCommand("js", new Date());
  sendInitializationCommand(
    "config",
    measurementId,
    buildGoogleAnalyticsConfig(debugMode),
  );
  initializedConfiguration = configuration;
  openAnalyticsTransport();
}

export function revokeGoogleAnalyticsConsent(): void {
  revokeAmplitudeConsent();
  analyticsTransportReady = false;
  pendingAnalyticsCommands.length = 0;

  if (
    initializedConfiguration === null ||
    typeof window === "undefined" ||
    typeof window.gtag !== "function"
  ) {
    return;
  }

  sendInitializationCommand("set", { user_id: null });
  sendInitializationCommand(
    "consent",
    "update",
    buildGoogleAnalyticsConsentState("denied"),
  );
}

export function trackAnalyticsPageView(
  params: AnalyticsPageViewParams,
): void {
  sendAnalyticsDataCommand("event", "page_view", params);
}
