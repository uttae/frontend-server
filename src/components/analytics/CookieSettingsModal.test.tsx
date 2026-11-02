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
// 쿠키 설정은 ui Dialog(Base UI)라 document.body로 포털된 role="dialog"다
function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}
function toggle() {
  return document.querySelector<HTMLButtonElement>('[role="switch"]')!;
}
function resultMessage() {
  return dialog()!.querySelector<HTMLElement>('[aria-live="polite"]')!;
}
function isPageScrollLocked() {
  return [document.documentElement, document.body].some(
    (element) => element.style.overflowY === "hidden",
  );
}
// Base UI는 처음 포커스를 requestAnimationFrame 뒤에, 스크롤 잠금·해제를 setTimeout 0 뒤에 반영한다
async function settle() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
// 브라우저의 Tab 이동처럼 문서 순서상 다음(이전) tabbable로 포커스를 옮긴다.
// 대화상자 앞뒤의 보이지 않는 칸에 닿으면 Base UI가 포커스를 대화상자 안 반대쪽 끝으로 되돌린다
async function pressTab(shift = false) {
  const tabbables = [...document.querySelectorAll<HTMLElement>("*")].filter(
    (node) => node.tabIndex >= 0 && !(node as HTMLButtonElement).disabled,
  );
  const index = tabbables.indexOf(document.activeElement as HTMLElement);
  await act(async () => tabbables[index + (shift ? -1 : 1)].focus());
  await settle();
}
async function toggleDraft() {
  await act(async () => toggle().click());
}
async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
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
    const opened = dialog()!;
    expect(opened).not.toBeNull();
    expect(opened.hasAttribute("data-open")).toBe(true);
    expect(
      document.getElementById(opened.getAttribute("aria-labelledby")!)
        ?.textContent,
    ).toBe("쿠키 설정");
    expect(opened.contains(document.activeElement)).toBe(true);
    // 모달 바깥(앱)은 보조기기에서 가려진다
    expect(host.getAttribute("aria-hidden")).toBe("true");
    expect(button("저장").disabled).toBe(false);
    await toggleDraft();
    expect(opened.textContent).not.toContain("저장을 누르면");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(document.cookie).not.toContain("uttae_analytics_consent");
    const first = button("쿠키 설정 닫기");
    const last = button("저장");
    last.focus();
    await pressTab();
    expect(document.activeElement).toBe(first);
    await pressTab(true);
    expect(document.activeElement).toBe(last);
    await act(async () =>
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    await settle();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button("쿠키 설정"));
    expect(host.hasAttribute("aria-hidden")).toBe(false);
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
    expect(dialog()).toBeNull();
    expect(document.cookie).toContain("v1:denied");
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await toggleDraft();
    // 딤(배경)을 누르면 닫힌다
    await act(async () =>
      document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!.click(),
    );
    await settle();
    expect(dialog()).toBeNull();
    expect(document.cookie).toContain("v1:denied");
  });

  it("closes with 취소 and discards the edited choice without saving it", async () => {
    document.cookie = "uttae_analytics_consent=v1:denied; Path=/";
    await click("쿠키 설정");
    await toggleDraft();
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    await click("취소");
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(button("쿠키 설정"));
    // 저장(grantAnalyticsConsent)이 실행됐다면 쿠키·스토어가 granted로 바뀐다
    expect(document.cookie).toContain("uttae_analytics_consent=v1:denied");
    expect(document.cookie).not.toContain("v1:granted");
    expect(analyticsConsentStore.getSnapshot()).toBe("denied");
    await click("쿠키 설정");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(resultMessage().textContent).toBe("");
  });

  it("closes untouched pending with 취소 without recording a denial", async () => {
    await click("쿠키 설정");
    await click("취소");
    expect(dialog()).toBeNull();
    // 저장(denyAnalyticsConsent)이 실행됐다면 GA 철회가 불리고 denied 쿠키가 남는다
    expect(revokeGoogleAnalyticsConsent).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("uttae_analytics_consent");
    expect(analyticsConsentStore.getSnapshot()).toBe("pending");
  });

  it("shows the save result in a live region below the buttons and keeps the dialog open", async () => {
    await click("쿠키 설정");
    const live = resultMessage();
    expect(live.textContent).toBe("");
    for (const label of ["취소", "저장"]) {
      expect(
        button(label).compareDocumentPosition(live) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    await click("저장");
    expect(dialog()).not.toBeNull();
    expect(resultMessage().textContent).toBe("분석 쿠키를 거부했습니다.");
    // 선택을 바꾸면 지난 결과 문장은 지운다
    await toggleDraft();
    expect(resultMessage().textContent).toBe("");
    await click("저장");
    expect(dialog()).not.toBeNull();
    expect(resultMessage().textContent).toBe("분석 쿠키를 허용했습니다.");
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
    expect(resultMessage().textContent).toBe("분석 쿠키를 허용했습니다.");
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
  expect(dialog()).not.toBeNull();
  expect(resultMessage().textContent).toContain(
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
    expect(dialog()!.textContent).not.toContain("저장을 누르면");
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
  await settle();
  expect(dialog()).toBeNull();
  expect(document.activeElement).toBe(button("쿠키 설정"));
  expect(analyticsConsentStore.getSnapshot()).toBe("granted");
  await click("쿠키 설정");
  expect(toggle().getAttribute("aria-checked")).toBe("true");
});

it("cancels untouched pending with X and restores body scroll", async () => {
  expect(isPageScrollLocked()).toBe(false);
  await click("쿠키 설정");
  expect(isPageScrollLocked()).toBe(true);
  await click("쿠키 설정 닫기");
  expect(dialog()).toBeNull();
  expect(analyticsConsentStore.getSnapshot()).toBe("pending");
  expect(document.cookie).not.toContain("uttae_analytics_consent");
  expect(isPageScrollLocked()).toBe(false);
  await click("쿠키 설정");
  expect(toggle().getAttribute("aria-checked")).toBe("false");
});

it("restores focus to the app main when saving removes the only trigger", async () => {
  const main = document.createElement("main");
  host.append(main);
  await click("쿠키 설정");
  // Saving a pending consent removes the banner that owned this trigger.
  const trigger = button("쿠키 설정");
  trigger.remove();
  try {
    await click("쿠키 설정 닫기");
    expect(document.activeElement).toBe(main);
    expect(main.hasAttribute("tabindex")).toBe(false);
  } finally {
    host.prepend(trigger);
    main.remove();
  }
});
