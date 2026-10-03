"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  MOBILE_VIEW_DEFAULT,
  readMobileViewState,
  type MobileViewState,
} from "@/lib/mobile-view";

export type MobileViewContextValue = MobileViewState;

const MobileViewContext = createContext<MobileViewContextValue>(MOBILE_VIEW_DEFAULT);

/** Tailwind `mobile:` 배리언트가 매칭하는 <html> 클래스 */
const MOBILE_DEVICE_HTML_CLASS = "is-mobile-device";

export function MobileViewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileViewState>(() =>
    typeof window === "undefined" ? MOBILE_VIEW_DEFAULT : readMobileViewState(),
  );

  useEffect(() => {
    const sync = () => setState(readMobileViewState());

    sync();
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      MOBILE_DEVICE_HTML_CLASS,
      state.isMobileDevice,
    );
  }, [state.isMobileDevice]);

  const value = useMemo(
    () => ({
      isMobileDevice: state.isMobileDevice,
    }),
    [state.isMobileDevice],
  );

  return (
    <MobileViewContext.Provider value={value}>
      {children}
    </MobileViewContext.Provider>
  );
}

export function useMobileView(): MobileViewContextValue {
  return useContext(MobileViewContext);
}
