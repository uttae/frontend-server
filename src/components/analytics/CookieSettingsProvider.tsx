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

/**
 * 닫힐 때 포커스를 돌려줄 곳. 동의를 저장하면 배너(연 트리거)가 사라지므로 Base UI 기본(연 요소)만으로는 포커스가 사라진다.
 * 연 요소 → 남은 쿠키 설정 트리거(푸터 등) → 앱 main 순서로 고른다(옛 SettingsDialog 규칙).
 * main은 탭 순서에 없어 Base UI에 넘기면 그 안의 첫 tabbable로 가므로, 잠시 tabindex를 주고 직접 포커스한 뒤 false(Base UI는 옮기지 않음)를 돌려준다
 */
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
  // 연 순간 포커스가 있던 요소. 버튼은 자기에게 포커스한 뒤 열고, 레거시 URL 진입은 body다
  const openerRef = useRef<Element | null>(null);
  const openSettings = useCallback(() => {
    openerRef.current = document.activeElement;
    setOpen(true);
  }, []);
  return (
    <OpenCookieSettingsContext value={openSettings}>
      {children}
      {/* 열 때마다 저장된 선택을 다시 읽도록(AnalyticsConsentSettings draft) 닫으면 언마운트한다 */}
      {open && (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setOpen(false);
          }}
        >
          <DialogContent
            size="lg"
            closeLabel="쿠키 설정 닫기"
            finalFocus={() => getCookieSettingsReturnFocus(openerRef.current)}
          >
            <DialogHeader>
              <DialogTitle>쿠키 설정</DialogTitle>
            </DialogHeader>
            <AnalyticsConsentSettings />
          </DialogContent>
        </Dialog>
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
