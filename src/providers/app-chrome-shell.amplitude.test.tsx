import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const amplitudeRuntime = vi.hoisted(() => ({
  apiKey: "test-api-key",
  enabled: true,
  sessionReplaySampleRate: 1,
}));

vi.mock("@/components/analytics/ConsentGatedAnalytics", () => ({
  ConsentGatedAnalytics: ({ children }: { children: ReactNode }) => <div data-amplitude-root>{children}</div>,
}));

vi.mock("@/components/mobile/MobileChrome", () => ({
  MobileChrome: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime: {
    debugMode: false,
    enabled: false,
    measurementId: null,
  },
}));

vi.mock("@/lib/analytics/amplitude-runtime", () => ({
  amplitudeRuntime,
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
}));

import { AppChromeShell } from "@/providers/app-chrome-shell";

afterEach(() => {
  amplitudeRuntime.enabled = true;
});

it("keeps the Amplitude root mounted without GA configuration", () => {
  const html = renderToStaticMarkup(
    <AppChromeShell analytics={<div data-route-tracker />}>
      <main>content</main>
    </AppChromeShell>,
  );

  expect(html).toContain("data-amplitude-root");
  expect(html).toContain("data-route-tracker");
});

it("omits the analytics consent gate when GA and Amplitude are both disabled", () => {
  amplitudeRuntime.enabled = false;

  const html = renderToStaticMarkup(
    <AppChromeShell analytics={<div data-route-tracker />}>
      <main>content</main>
    </AppChromeShell>,
  );

  expect(html).not.toContain("data-amplitude-root");
  expect(html).not.toContain("data-route-tracker");
  expect(html).toContain("content");
});
