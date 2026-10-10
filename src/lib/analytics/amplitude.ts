"use client";

import * as amplitude from "@amplitude/unified";

import { amplitudeRuntime } from "@/lib/analytics/amplitude-runtime";
import { getAnalyticsEventRoomId } from "@/lib/analytics/room-events";
import { clearAnalyticsCookies } from "@/lib/analytics/consent-cookie";
const pendingAmplitudeCommands: unknown[][] = [];
let amplitudeInitialization: Promise<void> | null = null;
let amplitudeInitialized = false;
let amplitudeConsentState: "denied" | "granted" | "unknown" = "unknown";
let identityResetPending = false;

function applyPendingIdentityReset(): boolean {
  if (!identityResetPending) return true;
  try {
    amplitude.reset();
    identityResetPending = false;
    return true;
  } catch {
    // Keep the boundary pending; don't attribute later events to the old identity.
    return false;
  }
}

/** Authenticated → logged-out transition only; never initializes or grants consent. */
export function resetAmplitudeIdentityOnLogout(): void {
  if (typeof window === "undefined" || !amplitudeRuntime.enabled) return;
  pendingAmplitudeCommands.length = 0;
  identityResetPending = true;

  if (amplitudeInitialized) {
    applyPendingIdentityReset();
    return;
  }

  // The SDK may not have started (for example consent is denied). Remove its
  // saved identity now so a reload cannot restore the logged-out user's device.
  if (amplitudeRuntime.apiKey) {
    try {
      clearAnalyticsCookies([`AMP_${amplitudeRuntime.apiKey.slice(0, 10)}`]);
    } catch {
      // Storage restrictions must not block session teardown; retain pending reset.
    }
  }
  if (amplitudeInitialization !== null) {
    // Pause SDK autocapture until initialization can complete the identity reset.
    try { amplitude.setOptOut(true); } catch { /* Analytics must not block logout. */ }
  }
}

function dispatchAmplitudeDataCommand(...args: unknown[]): void {
  const [command, nameOrProperties, maybeProperties] = args;

  if (command === "event" && typeof nameOrProperties === "string") {
    const eventProperties =
      typeof maybeProperties === "object" && maybeProperties !== null
        ? (maybeProperties as Record<string, unknown>)
        : undefined;
    const roomId = getAnalyticsEventRoomId(nameOrProperties, eventProperties);
    const propertiesWithoutRoom = eventProperties && "room_id" in eventProperties
      ? Object.fromEntries(Object.entries(eventProperties).filter(([key]) => key !== "room_id"))
      : eventProperties;
    if (roomId) {
      // Event-scoped groups never attach this room to the user's later events.
      amplitude.track({
        event_type: nameOrProperties,
        event_properties: { ...propertiesWithoutRoom, room_id: roomId },
        groups: { room_id: roomId },
      });
    } else {
      amplitude.track(nameOrProperties, propertiesWithoutRoom);
    }
    return;
  }

  if (
    command === "set" &&
    typeof nameOrProperties === "object" &&
    nameOrProperties !== null &&
    "user_id" in nameOrProperties
  ) {
    const userId = (nameOrProperties as { user_id?: unknown }).user_id;
    amplitude.setUserId(typeof userId === "string" ? userId : undefined);
  }
}

function flushPendingAmplitudeCommands(): void {
  for (const command of pendingAmplitudeCommands.splice(0)) {
    dispatchAmplitudeDataCommand(...command);
  }
}

export function initializeAmplitude(): void {
  if (
    typeof window === "undefined" ||
    !amplitudeRuntime.enabled ||
    !amplitudeRuntime.apiKey
  ) {
    return;
  }

  amplitudeConsentState = "granted";

  if (amplitudeInitialized) {
    if (!applyPendingIdentityReset()) return;
    amplitude.setOptOut(false);
    flushPendingAmplitudeCommands();
    return;
  }

  if (amplitudeInitialization !== null) return;

  const initialization = amplitude.initAll(amplitudeRuntime.apiKey, {
    analytics: {
      minIdLength: 1,
      autocapture: {
        attribution: true,
        elementInteractions: false,
        fileDownloads: false,
        formInteractions: false,
        frustrationInteractions: false,
        networkTracking: false,
        pageUrlEnrichment: false,
        pageViews: false,
        performanceTracking: false,
        sessions: true,
        webVitals: false,
      },
    },
    sessionReplay: {
      privacyConfig: {
        blockSelector: [".amp-block", "[data-amplitude-block]"],
        defaultMaskLevel: "conservative",
        maskSelector: [".amp-mask", "[data-amplitude-mask]"],
      },
      sampleRate: amplitudeRuntime.sessionReplaySampleRate,
    },
  });
  amplitudeInitialization = initialization;

  void initialization
    .then(() => {
      if (amplitudeInitialization !== initialization) return;

      amplitudeInitialized = true;
      if (!applyPendingIdentityReset()) return;
      if (amplitudeConsentState !== "granted") return;

      amplitude.setOptOut(false);
      flushPendingAmplitudeCommands();
    })
    .catch(() => {
      if (amplitudeInitialization !== initialization) return;

      amplitudeInitialization = null;
      amplitudeInitialized = false;
    });
}

export function sendAmplitudeDataCommand(...args: unknown[]): void {
  if (typeof window === "undefined" || !amplitudeRuntime.enabled) return;
  if (amplitudeConsentState === "denied") return;

  if (!amplitudeInitialized) {
    pendingAmplitudeCommands.push(args);
    return;
  }

  if (!applyPendingIdentityReset()) return;
  dispatchAmplitudeDataCommand(...args);
}

export function revokeAmplitudeConsent(): void {
  amplitudeConsentState = "denied";
  pendingAmplitudeCommands.length = 0;
  if (typeof window === "undefined" || amplitudeInitialization === null) return;

  amplitude.setUserId(undefined);
  amplitude.setOptOut(true);
}
