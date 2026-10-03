"use client";

import type { ReactNode } from "react";

import { MobileViewProvider } from "@/contexts/MobileViewContext";

/** 앱 루트 — 모바일 감지만 제공하고 화면 방향은 브라우저에 맡긴다. */
export function MobileChrome({ children }: { children: ReactNode }) {
  return (
    <MobileViewProvider>
      {children}
    </MobileViewProvider>
  );
}
