"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { MapWithDetailPanel } from "@/components/map";
import { useMobileView } from "@/contexts/MobileViewContext";
import { readMapRouteParams } from "@/lib/mobile-view";

import { useMobileRouteView } from "./_components/useMobileRouteView";

/**
 * `/map` — 모바일 전용 지도 화면. PC는 지도가 레이아웃에 붙어 있어 일정으로 보낸다.
 * `?view=route`면 같은 지도 위에 일차별 경로 보기를 얹는다(지도를 새로 만들지 않는다).
 */
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
