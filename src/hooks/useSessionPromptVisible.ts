"use client";

import { useCallback, useState } from "react";
import { useClientReady } from "./useClientReady";

export function useSessionPromptVisible(storageKey: string) {
  const ready = useClientReady();
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  let storedDismissed = false;
  if (ready) {
    try {
      storedDismissed = sessionStorage.getItem(storageKey) === "1";
    } catch {}
  }
  const visible = ready && !storedDismissed && !dismissedKeys.has(storageKey);
  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {}
    setDismissedKeys((keys) => new Set(keys).add(storageKey));
  }, [storageKey]);
  return { visible, dismiss };
}
