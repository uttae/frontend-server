"use client";

import type { ReactNode } from "react";

import { MobileViewProvider } from "@/contexts/MobileViewContext";

export function MobileChrome({ children }: { children: ReactNode }) {
  return (
    <MobileViewProvider>
      {children}
    </MobileViewProvider>
  );
}
