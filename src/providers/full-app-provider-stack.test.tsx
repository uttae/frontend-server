import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOrCreateQueryClient: vi.fn(() => ({ id: "query-client" })),
  useQueryClient: vi.fn(() => ({ id: "query-client" })),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: ReactNode }) => <div data-provider="query-client">{children}</div>,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div data-provider="query-devtools" />,
}));

vi.mock("@/components/analytics/AnalyticsRouteTracker", () => ({
  AnalyticsRouteTracker: () => <div data-tracker="session" />,
}));

vi.mock("@/components/analytics/ConsentGatedAnalytics", () => ({
  ConsentGatedAnalytics: ({ children }: { children: ReactNode }) => <div data-provider="analytics">{children}</div>,
}));

vi.mock("@/components/google-maps-provider", () => ({
  GoogleMapsProvider: ({ children }: { children: ReactNode }) => <div data-provider="google-maps">{children}</div>,
}));

vi.mock("@/components/mobile/MobileChrome", () => ({
  MobileChrome: ({ children }: { children: ReactNode }) => <div data-provider="mobile-chrome">{children}</div>,
}));

vi.mock("@/contexts/StompContext", () => ({
  StompProvider: ({ children }: { children: ReactNode }) => <div data-provider="stomp">{children}</div>,
}));

vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime: {
    debugMode: false,
    enabled: true,
    measurementId: "G-TEST",
  },
}));

vi.mock("@/lib/auth", () => ({
  reconcileClientSession: vi.fn(),
}));

vi.mock("@/lib/query-client", () => ({
  getOrCreateQueryClient: mocks.getOrCreateQueryClient,
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-provider="toaster" />,
}));

import { FullAppProviderStack } from "@/providers/full-app-provider-stack";

test("retains the complete provider and session-aware analytics stack", () => {
  const html = renderToStaticMarkup(
    <FullAppProviderStack>
      <main>app content</main>
    </FullAppProviderStack>,
  );

  expect(html).toContain('data-provider="query-client"');
  expect(html).toContain('data-provider="stomp"');
  expect(html).toContain('data-provider="google-maps"');
  expect(html).toContain('data-provider="mobile-chrome"');
  expect(html).toContain('data-provider="analytics"');
  expect(html).toContain('data-provider="toaster"');
  expect(html).toContain('data-tracker="session"');
  expect(html).toContain("app content");
  expect(mocks.getOrCreateQueryClient).toHaveBeenCalledTimes(1);
  expect(mocks.useQueryClient).toHaveBeenCalledTimes(1);
});
