"use client";

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { width } from "@/lib/layout-tokens";

type WidthToken = keyof typeof width;

type SectionWidthContextType = {
  maxWidth: string;
  setMaxWidth: (width: string) => void;
};

const SectionWidthContext = createContext<SectionWidthContextType>({
  maxWidth: "",
  setMaxWidth: () => {},
});

export function SectionWidthProvider({ children }: { children: ReactNode }) {
  const [maxWidth, setMaxWidth] = useState("");
  const value = useMemo(() => ({ maxWidth, setMaxWidth }), [maxWidth]);
  return <SectionWidthContext.Provider value={value}>{children}</SectionWidthContext.Provider>;
}

export function useSectionWidth() {
  return useContext(SectionWidthContext);
}

export function SetSectionMaxWidth({ value }: { value: WidthToken }) {
  const { setMaxWidth } = useSectionWidth();
  useEffect(() => {
    setMaxWidth(width[value]);
    return () => setMaxWidth("");
  }, [value, setMaxWidth]);
  return null;
}
