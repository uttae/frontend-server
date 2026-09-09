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
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/?keep=1#team");
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('[aria-label="쿠키 설정 닫기"]')!
        .click(),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector("button"));
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
