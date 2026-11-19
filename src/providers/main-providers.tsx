"use client";

import type { ReactNode } from "react";

import { MainChromeLayoutWidthProvider } from "@/contexts/MainChromeLayoutWidthContext";
import { SelectedPlaceProvider } from "@/contexts/SelectedPlaceContext";
import { SectionWidthProvider } from "@/contexts/SectionWidthContext";

export function MainChromeProviders({ children }: { children: ReactNode }) {
  return (
    <SectionWidthProvider>
      <MainChromeLayoutWidthProvider>
        <SelectedPlaceProvider>{children}</SelectedPlaceProvider>
      </MainChromeLayoutWidthProvider>
    </SectionWidthProvider>
  );
}
