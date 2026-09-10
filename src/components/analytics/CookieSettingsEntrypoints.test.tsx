// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/components/mobile/MobileChrome", () => ({
  MobileChrome: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("@/lib/analytics/runtime", () => ({
  analyticsRuntime: { enabled: false },
}));
vi.mock("@/lib/analytics/amplitude-runtime", () => ({
  amplitudeRuntime: { enabled: false },
}));
import { AppChromeShell } from "@/providers/app-chrome-shell";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { ConsentGatedAnalytics } from "./ConsentGatedAnalytics";

it("opens the same dialog from footer and banner without navigation, even with analytics disabled", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState({}, "", "/home");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const reject = vi.fn();
  const accept = vi.fn();
  try {
    await act(async () =>
      root.render(
        <AppChromeShell analytics={null}>
          <SiteFooter />
          <CookieConsentBanner onAccept={accept} onReject={reject} />
        </AppChromeShell>,
      ),
    );
    const triggers = [...host.querySelectorAll("button")].filter(
      (node) => node.textContent === "쿠키 설정",
    );
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      await act(async () => trigger.click());
      expect(document.querySelectorAll('dialog[open]')).toHaveLength(1);
      expect(window.location.pathname).toBe("/home");
      await act(async () =>
        document
          .querySelector<HTMLButtonElement>('[aria-label="쿠키 설정 닫기"]')!
          .click(),
      );
      expect(document.activeElement).toBe(trigger);
    }
    expect(accept).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
    expect(host.querySelector('footer a[href="/privacy"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

const source = (file: string) => readFileSync(`src/${file}`, "utf8");
it("retains landing and room footers and removes only the requested navigation entries", () => {
  expect(source("app/_components/LandingView.tsx")).toContain("<SiteFooter");
  expect(source("app/home/page.tsx")).toContain("<SiteFooter");
  const sidebar = source("components/layout/SideBar.tsx");
  expect(sidebar).not.toContain("PrivacySettingsLink");
  for (const entry of [
    "search",
    "plan",
    "bookmark",
    "member-settings",
    "room-settings",
    "SidebarFeedbackFormButton",
    "SidebarContactButton",
    "openChat",
  ])
    expect(sidebar).toContain(entry);
  const profile = source("app/home/_components/HomeHeader.tsx");
  expect(profile).not.toContain("개인정보 설정");
  expect(profile).not.toContain("PrivacySettingsLink");
  expect(profile).toContain("로그아웃");
  expect(profile).toContain("회원 탈퇴");
  const mobile = source("components/mobile/MobileMainTabs.tsx");
  expect(mobile).not.toMatch(/privacy-settings|쿠키 설정/);
  for (const entry of ["북마크", "멤버", "방설정", "채팅", "일정", "지도"])
    expect(mobile).toContain(entry);
  expect(source("components/layout/MainLayoutChrome.tsx")).not.toContain(
    "SiteFooter",
  );
});

it("returns focus to the footer when saving consent removes the original banner trigger", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  document.cookie = "uttae_analytics_consent=; Max-Age=0; Path=/";
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <AppChromeShell analytics={null}>
          <SiteFooter />
          <ConsentGatedAnalytics gaId="" debugMode={false}>
            {null}
          </ConsentGatedAnalytics>
        </AppChromeShell>,
      ),
    );
    const banner = host.querySelector('[aria-label="쿠키 동의"]')!;
    const trigger = [...banner.querySelectorAll("button")].find(
      (node) => node.textContent === "쿠키 설정",
    )!;
    await act(async () => trigger.click());
    const dialogButtons = () => [
      ...document.querySelectorAll('dialog[open] button'),
    ];
    await act(async () =>
      (
        dialogButtons().find(
          (node) => node.textContent === "저장",
        ) as HTMLButtonElement
      ).click(),
    );
    expect(host.querySelector('[aria-label="쿠키 동의"]')).toBeNull();
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="쿠키 설정 닫기"]')!
        .click(),
    );
    expect(document.activeElement).toBe(host.querySelector("footer button"));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
