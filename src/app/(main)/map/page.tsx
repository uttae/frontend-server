"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { MapWithDetailPanel } from "@/components/map";
import { useMobileView } from "@/contexts/MobileViewContext";
import { readMapRouteParams } from "@/lib/mobile-view";

import { useMobileRouteView } from "./_components/useMobileRouteView";

export default function MapPage() {
  const router = useRouter();
  const { isMobileDevice } = useMobileView();
  const route = readMapRouteParams(useSearchParams());
  const routeView = useMobileRouteView({
    active: isMobileDevice && route.active,
    day: route.day,
    initialItemId: route.itemId,
  });

  useEffect(() => {
    if (!isMobileDevice) router.replace("/plan");
  }, [isMobileDevice, router]);

  if (!isMobileDevice) return null;
  return (
    <MapWithDetailPanel
      mobileInline
      routeView={routeView.mapRouteView}
      onOpenRouteView={routeView.open}
    >
      {routeView.overlay}
    </MapWithDetailPanel>
  );
}
