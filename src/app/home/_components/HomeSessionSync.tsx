"use client";

import type { ReactNode } from "react";

import { useSessionStore } from "@/stores/session-store";

export function HomeSessionSync({ children }: { children: ReactNode }) {
  const sessionReady = useSessionStore((s) => s.sessionReady);

  if (!sessionReady) {
    return null;
  }

  return <>{children}</>;
}
