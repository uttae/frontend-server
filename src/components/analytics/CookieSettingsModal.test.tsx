// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/client", () => ({
  revokeGoogleAnalyticsConsent: vi.fn(),
}));
import { createAnalyticsConsentStore } from "@/lib/analytics/consent-store";
import {
  readAnalyticsConsentCookie,
  writeAnalyticsConsentCookie,
} from "@/lib/analytics/consent-cookie";
import { revokeGoogleAnalyticsConsent } from "@/lib/analytics/client";
let CookieSettingsProvider: typeof import("./CookieSettingsProvider").CookieSettingsProvider;
let CookieSettingsButton: typeof import("./CookieSettingsProvider").CookieSettingsButton;
let analyticsConsentStore: typeof import("@/lib/analytics/consent-store").analyticsConsentStore;

let root: Root;
let host: HTMLDivElement;
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(
    (node) =>
      node.textContent === label || node.getAttribute("aria-label") === label,
  );
  expect(found, label).toBeTruthy();
  return found!;
}
function toggle() {
  return document.querySelector<HTMLButtonElement>('[role="switch"]')!;
}
async function toggleDraft() {
  await act(async () => toggle().click());
}
async function click(label: string) {
  await act(async () => button(label).click());
}
async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <CookieSettingsProvider>
        <CookieSettingsButton>쿠키 설정</CookieSettingsButton>
        <a href="/privacy">외부 링크</a>
      </CookieSettingsProvider>,
    ),
  );
}
async function unmount() {
  await act(async () => root.unmount());
  host.remove();
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.resetModules();
  ({ CookieSettingsProvider, CookieSettingsButton } =
    await import("./CookieSettingsProvider"));
  ({ analyticsConsentStore } = await import("@/lib/analytics/consent-store"));
  document.cookie = "uttae_analytics_consent=; Max-Age=0; Path=/";
  document.cookie = "_ga=; Max-Age=0; Path=/";
  window.history.replaceState({}, "", "/home?view=all#footer");
  await mount();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await unmount();
});

describe("cookie settings modal", () => {
  it("opens in place, traps keyboard focus and dismisses with Escape without saving", async () => {
    await click("쿠키 설정");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("쿠키 설정");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(host.hasAttribute("inert")).toBe(true);
    expect(button("저장").disabled).toBe(false);
    await toggleDraft();
    expect(dialog.textContent).not.toContain("저장을 누르면");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(document.cookie).not.toContain("uttae_analytics_consent");
    const first = button("쿠키 설정 닫기");
    const last = button("저장");
    last.focus();
    await act(async () =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(first);
    await act(async () =>
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement).toBe(last);
    await act(async () =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button("쿠키 설정"));
    expect(host.hasAttribute("inert")).toBe(false);
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/home?view=all#footer");
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("loads saved choices on every opening and discards edits on close and backdrop", async () => {
    document.cookie = "uttae_analytics_consent=v1:denied; Path=/";
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await toggleDraft();
    await click("쿠키 설정 닫기");
    expect(document.cookie).toContain("v1:denied");
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await toggleDraft();
    await act(async () =>
      (document.querySelector('[role="presentation"]') as HTMLElement).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.cookie).toContain("v1:denied");
  });

  it("persists save through reopen/remount and withdraws via existing consent actions", async () => {
    await click("쿠키 설정");
    await toggleDraft();
    await click("저장");
    expect(document.cookie).toContain("uttae_analytics_consent=v1:granted");
    // A fresh store has no in-memory session override, as after a page reload.
    expect(
      createAnalyticsConsentStore({
        read: readAnalyticsConsentCookie,
        write: writeAnalyticsConsentCookie,
      }).getSnapshot(),
    ).toBe("granted");
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "분석 쿠키를 허용했습니다.",
    );
    await click("쿠키 설정 닫기");
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    await unmount();
    await mount();
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    document.cookie = "_ga=synthetic; Path=/";
    await toggleDraft();
    expect(revokeGoogleAnalyticsConsent).not.toHaveBeenCalled();
    await click("저장");
    expect(revokeGoogleAnalyticsConsent).toHaveBeenCalledOnce();
    expect(document.cookie).toContain("uttae_analytics_consent=v1:denied");
    expect(document.cookie).not.toContain("_ga=");
  });
});

it("keeps the dialog open and reports a blocked cookie write accurately", async () => {
  await click("쿠키 설정");
  await toggleDraft();
  vi.spyOn(document, "cookie", "set").mockImplementation(() => {});
  await click("저장");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
    "브라우저에 저장하지 못했습니다",
  );
  expect(toggle().getAttribute("aria-checked")).toBe("true");
  expect(document.cookie).not.toContain("v1:granted");
});

describe("analytics allow switch", () => {
  it("shows pending as OFF without recording a decision and toggles only the draft", async () => {
    await click("쿠키 설정");
    const toggle = document.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute("aria-checked")).toBe("false");
    expect(toggle!.type).toBe("button");
    expect(toggle!.getAttribute("aria-labelledby")).toBeTruthy();
    expect(
      document.getElementById(toggle!.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("분석 쿠키");
    expect(toggle!.textContent?.trim()).toBe("");
    const descriptionIds = toggle!.getAttribute("aria-describedby")!.split(" ");
    for (const id of descriptionIds) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(
      descriptionIds.map((id) => document.getElementById(id)!.textContent).join(" "),
    ).toContain("Google Analytics");
    expect(document.querySelector('[role="dialog"]')!.textContent).not.toContain(
      "저장을 누르면",
    );
    expect(analyticsConsentStore.getSnapshot()).toBe("pending");
    await act(async () => toggle!.click());
    expect(toggle!.getAttribute("aria-checked")).toBe("true");
    expect(analyticsConsentStore.getSnapshot()).toBe("pending");
    expect(document.cookie).not.toContain("uttae_analytics_consent");
    await act(async () => toggle!.click());
    expect(toggle!.getAttribute("aria-checked")).toBe("false");
    expect(analyticsConsentStore.getSnapshot()).toBe("pending");
    expect(revokeGoogleAnalyticsConsent).not.toHaveBeenCalled();
  });

  it("explicitly denies when saving untouched pending OFF", async () => {
    await click("쿠키 설정");
    expect(analyticsConsentStore.getSnapshot()).toBe("pending");
    expect(button("저장").disabled).toBe(false);
    await click("저장");
    expect(document.cookie).toContain("uttae_analytics_consent=v1:denied");
    expect(analyticsConsentStore.getSnapshot()).toBe("denied");
    expect(revokeGoogleAnalyticsConsent).toHaveBeenCalledOnce();
  });
});

it("retains the draft through disclosure and keyboard focus, without applying it on Escape", async () => {
  document.cookie = "uttae_analytics_consent=v1:granted; Path=/";
  await click("쿠키 설정");
  await toggleDraft();
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  const details = document.querySelector("details")!;
  const summary = details.querySelector("summary")!;
  await act(async () => summary.click());
  expect(details.open).toBe(true);
  summary.focus();
  expect(document.activeElement).toBe(summary);
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(analyticsConsentStore.getSnapshot()).toBe("granted");
  expect(revokeGoogleAnalyticsConsent).not.toHaveBeenCalled();
  await act(async () =>
    summary.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(button("쿠키 설정"));
  expect(analyticsConsentStore.getSnapshot()).toBe("granted");
  await click("쿠키 설정");
  expect(toggle().getAttribute("aria-checked")).toBe("true");
});

it("cancels untouched pending with X and restores body scroll", async () => {
  const overflow = document.body.style.overflow;
  await click("쿠키 설정");
  expect(document.body.style.overflow).toBe("hidden");
  await click("쿠키 설정 닫기");
  expect(analyticsConsentStore.getSnapshot()).toBe("pending");
  expect(document.cookie).not.toContain("uttae_analytics_consent");
  expect(document.body.style.overflow).toBe(overflow);
  await click("쿠키 설정");
  expect(toggle().getAttribute("aria-checked")).toBe("false");
});
