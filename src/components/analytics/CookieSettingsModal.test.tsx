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
import {
  CookieSettingsProvider,
  CookieSettingsButton,
} from "./CookieSettingsProvider";

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
    expect(button("선택 저장").disabled).toBe(true);
    await click("허용");
    expect(dialog.textContent).toContain("저장할 선택: 분석 쿠키 허용");
    expect(document.cookie).not.toContain("uttae_analytics_consent");
    const first = button("쿠키 설정 닫기");
    const last = button("선택 저장");
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
    expect(button("허용").getAttribute("aria-pressed")).toBe("false");
  });

  it("loads saved choices on every opening and discards edits on close and backdrop", async () => {
    document.cookie = "uttae_analytics_consent=v1:denied; Path=/";
    await click("쿠키 설정");
    expect(button("거부").getAttribute("aria-pressed")).toBe("true");
    await click("허용");
    await click("쿠키 설정 닫기");
    expect(document.cookie).toContain("v1:denied");
    await click("쿠키 설정");
    expect(button("거부").getAttribute("aria-pressed")).toBe("true");
    await click("허용");
    await act(async () =>
      (document.querySelector('[role="presentation"]') as HTMLElement).click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.cookie).toContain("v1:denied");
  });

  it("persists save through reopen/remount and withdraws via existing consent actions", async () => {
    await click("쿠키 설정");
    await click("허용");
    await click("선택 저장");
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
    expect(button("허용").getAttribute("aria-pressed")).toBe("true");
    await unmount();
    await mount();
    await click("쿠키 설정");
    expect(button("허용").getAttribute("aria-pressed")).toBe("true");
    document.cookie = "_ga=synthetic; Path=/";
    await click("거부");
    expect(revokeGoogleAnalyticsConsent).not.toHaveBeenCalled();
    await click("선택 저장");
    expect(revokeGoogleAnalyticsConsent).toHaveBeenCalledOnce();
    expect(document.cookie).toContain("uttae_analytics_consent=v1:denied");
    expect(document.cookie).not.toContain("_ga=");
  });
});

it("keeps the dialog open and reports a blocked cookie write accurately", async () => {
  await click("쿠키 설정");
  await click("허용");
  vi.spyOn(document, "cookie", "set").mockImplementation(() => {});
  await click("선택 저장");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
    "브라우저에 저장하지 못했습니다",
  );
  expect(button("허용").getAttribute("aria-pressed")).toBe("true");
  expect(document.cookie).not.toContain("v1:granted");
});
