"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { width } from "@/lib/layout-tokens";

type WidthToken = keyof typeof width;

type SectionWidthContextType = {
  maxWidth: string;
  setMaxWidth: (width: string) => void;
  /** 패널 오른쪽에 붙는 상세 패널 폭(px) — 데스크톱 최소 폭에 더한다(준비물 상세) */
  sideDetailWidthPx: number;
  setSideDetailWidthPx: (px: number) => void;
};

const SectionWidthContext = createContext<SectionWidthContextType>({
  maxWidth: "",
  setMaxWidth: () => {},
  sideDetailWidthPx: 0,
  setSideDetailWidthPx: () => {},
});

export function SectionWidthProvider({ children }: { children: ReactNode }) {
  const [maxWidth, setMaxWidth] = useState("");
  const [sideDetailWidthPx, setSideDetailWidthPx] = useState(0);
  const value = useMemo(
    () => ({ maxWidth, setMaxWidth, sideDetailWidthPx, setSideDetailWidthPx }),
    [maxWidth, sideDetailWidthPx],
  );
  return (
    <SectionWidthContext.Provider value={value}>
      {children}
    </SectionWidthContext.Provider>
  );
}

export function useSectionWidth() {
  return useContext(SectionWidthContext);
}

/** 상세 패널이 열려 있는 동안 그 폭을 레이아웃 최소 폭에 더한다. 닫히거나 화면을 떠나면 0으로 돌린다. */
export function SetSectionSideDetailWidth({ px }: { px: number }) {
  const { setSideDetailWidthPx } = useSectionWidth();
  useEffect(() => {
    setSideDetailWidthPx(px);
    return () => setSideDetailWidthPx(0);
  }, [px, setSideDetailWidthPx]);
  return null;
}

/** Drop into any page to declaratively set the section max-width. */
export function SetSectionMaxWidth({ value }: { value: WidthToken }) {
  const { setMaxWidth } = useSectionWidth();
  useEffect(() => {
    setMaxWidth(width[value]);
    return () => setMaxWidth("");
  }, [value, setMaxWidth]);
  return null;
}
