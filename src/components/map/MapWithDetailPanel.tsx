"use client";

import { useCallback, useState } from "react";

import { PlaceDetailPanel } from "@/components/place/PlaceDetailPanel";
import { MapToolbarLayoutProvider } from "@/contexts/MapToolbarLayoutContext";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useMapDiscoverToolbarOffset } from "@/hooks/useMapDiscoverToolbarOffset";
import { cn } from "@/lib/utils";

import Map from "./Map";

export function MapWithDetailPanel({
  mobileInline = false,
}: {
  mobileInline?: boolean;
}) {
  const { selectedPlace, setSelectedPlace } = useSelectedPlace();

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

      {/* Detail panel — 데스크톱: 지도 왼쪽에서 슬라이드 / 모바일: 하단에 꽉 붙는 바텀 시트 */}
      <div
        style={mobileInline ? undefined : { top: panelTopPx }}
        className={cn(
          "absolute z-20 flex flex-col overflow-hidden duration-300 ease-out",
          mobileInline
            ? "inset-x-0 bottom-0 h-[65%] rounded-t-2xl shadow-[0_-6px_24px_-4px_rgba(0,0,0,0.12)] transition-transform"
            : "bottom-3 left-2 w-[360px] rounded-xl shadow-[6px_0_24px_-4px_rgba(0,0,0,0.12),16px_0_32px_-6px_rgba(0,0,0,0.08)] transition-[transform,top]",
          selectedPlace
            ? "pointer-events-auto translate-x-0 translate-y-0"
            : mobileInline
              ? "pointer-events-none translate-y-full"
              : "pointer-events-none -translate-x-[calc(100%+32px)]",
        )}
      >
        {selectedPlace && (
          <PlaceDetailPanel
            {...selectedPlace}
            layout={mobileInline ? "sheet" : "panel"}
            onClose={() => setSelectedPlace(null)}
          />
        )}
      </div>
    </section>
  );
}
