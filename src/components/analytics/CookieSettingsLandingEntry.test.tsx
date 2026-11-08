// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
import {
  CookieSettingsProvider,
  CookieSettingsButton,
  CookieSettingsLandingEntry,
} from "./CookieSettingsProvider";
it("opens from the compatibility query once and preserves unrelated URL state", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState({}, "", "/?cookie-settings=open&keep=1#team");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <CookieSettingsProvider>
          <CookieSettingsLandingEntry />
          <CookieSettingsButton>쿠키 설정</CookieSettingsButton>
        </CookieSettingsProvider>,
      ),
    );
    // 쿠키 설정은 ui Dialog(Base UI)라 document.body로 포털된 role="dialog"다. 처음 포커스는 requestAnimationFrame 뒤에 옮긴다
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    await settle();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/?keep=1#team");
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="쿠키 설정 닫기"]')!
        .click(),
    );
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector("button"));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
