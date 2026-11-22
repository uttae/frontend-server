"use client";

import { createContext, useContext, useMemo, type ReactNode, type RefCallback } from "react";

type MapToolbarLayout = {
  setToolbarRef: RefCallback<HTMLElement>;
};

const MapToolbarLayoutContext = createContext<MapToolbarLayout | null>(null);

export function MapToolbarLayoutProvider({ setToolbarRef, children }: MapToolbarLayout & { children: ReactNode }) {
  const value = useMemo(() => ({ setToolbarRef }), [setToolbarRef]);
  return <MapToolbarLayoutContext.Provider value={value}>{children}</MapToolbarLayoutContext.Provider>;
}

export function useMapToolbarLayout(): MapToolbarLayout {
  const ctx = useContext(MapToolbarLayoutContext);
  if (!ctx) {
    throw new Error("useMapToolbarLayout must be used within MapToolbarLayoutProvider");
  }
  return ctx;
}
