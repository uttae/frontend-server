"use client";

import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { COOKIE_SETTINGS_QUERY_KEY } from "@/lib/analytics/paths";
import { AnalyticsConsentSettings } from "./AnalyticsConsentSettings";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

const OpenCookieSettingsContext = createContext<() => void>(() => {});

export function CookieSettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  const openSettings = useCallback(() => setOpen(true), []);
  const closeSettings = useCallback(() => setOpen(false), []);
  return (
    <OpenCookieSettingsContext value={openSettings}>
      {children}
      {open && (
        <SettingsDialog title="쿠키 설정" onClose={closeSettings}>
          <AnalyticsConsentSettings />
        </SettingsDialog>
      )}
    </OpenCookieSettingsContext>
  );
}

export function CookieSettingsButton({
  onClick,
  ...props
}: ComponentProps<"button">) {
  const openSettings = useContext(OpenCookieSettingsContext);
  return (
    <button
      {...props}
      type="button"
      aria-haspopup="dialog"
      data-cookie-settings-trigger
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          event.currentTarget.focus();
          openSettings();
        }
      }}
    />
  );
}

/** 레거시 URL에서만 사용하며 일반 푸터 열기는 주소를 변경하지 않습니다. */
export function CookieSettingsLandingEntry() {
  const searchParams = useSearchParams();
  const openSettings = useContext(OpenCookieSettingsContext);
  useEffect(() => {
    if (searchParams.get(COOKIE_SETTINGS_QUERY_KEY) !== "open") return;
    openSettings();
    const url = new URL(window.location.href);
    url.searchParams.delete(COOKIE_SETTINGS_QUERY_KEY);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [searchParams, openSettings]);
  return null;
}
