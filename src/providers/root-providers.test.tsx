import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appChromeShell: vi.fn(),
  pathname: "/",
  createQueryClient: vi.fn(() => ({ id: "query-client" })),
  dynamicOptions: undefined as { ssr?: boolean } | undefined,
  registerQueryClient: vi.fn(),
  useQueryClient: vi.fn(() => ({ id: "query-client" })),
}));

vi.mock("next/dynamic", () => ({
  default: (_loader: () => Promise<unknown>, options?: { ssr?: boolean }) => {
    mocks.dynamicOptions = options;
    return ({ children }: { children: ReactNode }) => <div data-provider="full-app-stack">{children}</div>;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: ReactNode }) => <div data-provider="query-client">{children}</div>,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div data-provider="query-devtools" />,
}));

vi.mock("@/components/analytics/AnonymousAnalyticsRouteTracker", () => ({
  AnonymousAnalyticsRouteTracker: () => <div data-tracker="anonymous" />,
}));

vi.mock("@/providers/app-chrome-shell", () => ({
  AppChromeShell: ({ analytics, children }: { analytics: ReactNode; children: ReactNode }) => (
    <>
      {mocks.appChromeShell({ analytics, children })}
      <div data-provider="mobile-chrome">{children}</div>
      <div data-provider="analytics">{analytics}</div>
      <div data-provider="toaster" />
    </>
  ),
}));

vi.mock("@/components/google-maps-provider", () => ({
  GoogleMapsProvider: ({ children }: { children: ReactNode }) => <div data-provider="google-maps">{children}</div>,
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
  createQueryClient: mocks.createQueryClient,
  registerQueryClient: mocks.registerQueryClient,
}));

import { AppRootProviders } from "@/providers/root-providers";

function renderAt(pathname: string): string {
  mocks.pathname = pathname;
  return renderToStaticMarkup(
    <AppRootProviders>
      <main>route content</main>
    </AppRootProviders>,
  );
}

describe("AppRootProviders route boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["/", "/login"])("keeps the exact public path %s on the lightweight shell", (pathname) => {
    const html = renderAt(pathname);

    expect(html).toContain('data-provider="mobile-chrome"');
    expect(html).toContain('data-provider="analytics"');
    expect(html).toContain('data-tracker="anonymous"');
    expect(html).toContain('data-provider="toaster"');
    expect(mocks.appChromeShell).toHaveBeenCalledTimes(1);
    expect(html).not.toContain('data-provider="full-app-stack"');
    expect(html).not.toContain('data-provider="query-client"');
    expect(html).not.toContain('data-provider="stomp"');
    expect(html).not.toContain('data-provider="google-maps"');
    expect(mocks.createQueryClient).not.toHaveBeenCalled();
    expect(mocks.useQueryClient).not.toHaveBeenCalled();
  });

  it.each(["/home", "/login/agreements", "/terms", "/privacy", "/operations-policy", "/copyright-policy"])(
    "retains the full app provider stack on %s",
    (pathname) => {
      const html = renderAt(pathname);

      expect(html).toContain('data-provider="full-app-stack"');
      expect(html).toContain("route content");
    },
  );

  it("keeps server rendering enabled for the async full-stack entry", () => {
    expect(mocks.dynamicOptions?.ssr).not.toBe(false);
  });
});
