"use client";

import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COOKIE_SETTINGS_QUERY_KEY } from "@/lib/analytics/paths";
import { AnalyticsConsentSettings } from "./AnalyticsConsentSettings";

const OpenCookieSettingsContext = createContext<() => void>(() => {});

function getCookieSettingsReturnFocus(opener: Element | null): HTMLElement | false {
  if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) return opener;
  const fallback = document.querySelector<HTMLElement>("[data-cookie-settings-trigger]");
  if (fallback) return fallback;
  const main = document.querySelector<HTMLElement>("main, [role=main]");
  if (!main) return false;
  const previousTabIndex = main.getAttribute("tabindex");
  main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
  if (previousTabIndex === null) main.removeAttribute("tabindex");
  else main.setAttribute("tabindex", previousTabIndex);
  return false;
}

export function CookieSettingsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<Element | null>(null);
  const openSettings = useCallback(() => {
    openerRef.current = document.activeElement;
    setOpen(true);
  }, []);
  return (
    <OpenCookieSettingsContext value={openSettings}>
      {children}
      {open && (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setOpen(false);
          }}
        >
          <DialogContent
            size="md"
            closeLabel="쿠키 설정 닫기"
            finalFocus={() => getCookieSettingsReturnFocus(openerRef.current)}
          >
            <DialogHeader>
              <DialogTitle>쿠키 설정</DialogTitle>
            </DialogHeader>
            <AnalyticsConsentSettings onCancel={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </OpenCookieSettingsContext>
  );
}

export function CookieSettingsButton({ onClick, ...props }: ComponentProps<"button">) {
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

export function CookieSettingsLandingEntry() {
  const searchParams = useSearchParams();
  const openSettings = useContext(OpenCookieSettingsContext);
  useEffect(() => {
    if (searchParams.get(COOKIE_SETTINGS_QUERY_KEY) !== "open") return;
    openSettings();
    const url = new URL(window.location.href);
    url.searchParams.delete(COOKIE_SETTINGS_QUERY_KEY);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [searchParams, openSettings]);
  return null;
}
