"use client";

import { createContext, useContext, type ReactNode, type RefCallback } from "react";

type MapToolbarLayout = {
  setToolbarRef: RefCallback<HTMLElement>;
};

const MapToolbarLayoutContext = createContext<MapToolbarLayout | null>(null);

export function MapToolbarLayoutProvider({ setToolbarRef, children }: MapToolbarLayout & { children: ReactNode }) {
  return <MapToolbarLayoutContext.Provider value={{ setToolbarRef }}>{children}</MapToolbarLayoutContext.Provider>;
}

export function useMapToolbarLayout(): MapToolbarLayout {
  const ctx = useContext(MapToolbarLayoutContext);
  if (!ctx) {
    throw new Error("useMapToolbarLayout must be used within MapToolbarLayoutProvider");
  }
  return ctx;
}
