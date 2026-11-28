import { useSyncExternalStore } from "react";

import { useMobileView } from "@/contexts/MobileViewContext";

const NARROW_WINDOW_QUERY = "(width < 48rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(NARROW_WINDOW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const clientSnapshot = () => window.matchMedia(NARROW_WINDOW_QUERY).matches;
const serverSnapshot = () => false;

export function useMobileLayout(): boolean {
  const { isMobileDevice } = useMobileView();
  const isNarrowWindow = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return isMobileDevice || isNarrowWindow;
}
