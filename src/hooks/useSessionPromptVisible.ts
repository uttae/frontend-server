"use client";

import { useCallback, useState } from "react";
import { useClientReady } from "./useClientReady";

/** sessionStorage에 dismiss 플래그가 없으면 visible — hydration 후 갱신 */
export function useSessionPromptVisible(storageKey: string) {
  const ready = useClientReady();
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  let storedDismissed = false;
  if (ready) {
    try {
      storedDismissed = sessionStorage.getItem(storageKey) === "1";
    } catch {
      /* private mode / quota */
    }
  }
  const visible = ready && !storedDismissed && !dismissedKeys.has(storageKey);
  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* private mode / quota */
    }
    setDismissedKeys((keys) => new Set(keys).add(storageKey));
  }, [storageKey]);
  return { visible, dismiss };
}
