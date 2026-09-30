"use client";

import { useCallback, useState } from "react";

import { PlaceDetailPanel } from "@/components/place/PlaceDetailPanel";
import { MapToolbarLayoutProvider } from "@/contexts/MapToolbarLayoutContext";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useMapDiscoverToolbarOffset } from "@/hooks/useMapDiscoverToolbarOffset";
import { cn } from "@/lib/utils";

import Map from "./Map";
import { MobileMapSearch } from "./MobileMapSearch";

export function MapWithDetailPanel({
  mobileInline = false,
}: {
  mobileInline?: boolean;
}) {
  const { selectedPlace, setSelectedPlace, onBack } = useSelectedPlace();

  const [mapSectionEl, setMapSectionEl] = useState<HTMLElement | null>(null);
  const setMapSectionRef = useCallback((el: HTMLElement | null) => {
    setMapSectionEl(el);
  }, []);

  const { setToolbarRef, panelTopPx } =
    useMapDiscoverToolbarOffset(mapSectionEl);

  return (
    <section
      ref={setMapSectionRef}
      className={cn(
        "relative h-full min-h-0 min-w-0 flex-1 basis-0 overflow-hidden",
        mobileInline
          ? "flex"
          : "hidden border-l border-gray-border s1:flex",
      )}
    >
      <MapToolbarLayoutProvider setToolbarRef={setToolbarRef}>
        <Map />
      </MapToolbarLayoutProvider>

      {/* Detail panel — 데스크톱: 지도 왼쪽에서 슬라이드 / 모바일: 헤더 아래 12px까지 펼쳐지는 바텀 시트 */}
      <div
        style={mobileInline ? undefined : { top: panelTopPx }}
        className={cn(
          "absolute z-20 flex flex-col duration-300 ease-out",
          mobileInline
            ? "pointer-events-none inset-x-0 bottom-0 top-3 transition-transform"
            : "bottom-3 left-2 w-[360px] overflow-hidden rounded-xl shadow-[6px_0_24px_-4px_rgba(0,0,0,0.12),16px_0_32px_-6px_rgba(0,0,0,0.08)] transition-[transform,top]",
          selectedPlace
            ? cn("translate-x-0 translate-y-0", !mobileInline && "pointer-events-auto")
            : mobileInline
              ? "translate-y-full"
              : "pointer-events-none -translate-x-[calc(100%+32px)]",
        )}
      >
        {selectedPlace && (
          <PlaceDetailPanel
            {...selectedPlace}
            layout={mobileInline ? "sheet" : "panel"}
            onClose={() => setSelectedPlace(null)}
            onBack={() => {
              setSelectedPlace(null);
              onBack?.();
            }}
          />
        )}
      </div>

      {mobileInline ? <MobileMapSearch /> : null}
    </section>
  );
}
