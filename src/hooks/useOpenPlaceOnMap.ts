"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useSelectedPlace, type SetSelectedPlaceOptions } from "@/contexts/SelectedPlaceContext";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { writeRoomMapViewport } from "@/lib/map-room-viewport-storage";
import { isMobileMapPathname, MOBILE_MAP_PATH } from "@/lib/mobile-view";
import type { SearchResultCardProps } from "@/types/place";

const PLACE_MAP_ZOOM = 16;

export function useOpenPlaceOnMap() {
  const { setSelectedPlace } = useSelectedPlace();
  const { isMobileDevice } = useMobileView();
  const { roomId } = useCurrentRoomId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (place: SearchResultCardProps, options?: SetSelectedPlaceOptions) => {
      const alreadyOnMap = isMobileMapPathname(pathname);
      if (!isMobileDevice || alreadyOnMap) {
        setSelectedPlace(place, options);
        return;
      }

      const query = searchParams.toString();
      const returnHref = query ? `${pathname}?${query}` : pathname;
      setSelectedPlace(place, {
        ...options,
        onBack: () => router.push(returnHref),
      });

      const rid = typeof roomId === "string" ? roomId.trim() : "";
      if (rid && place.location) {
        writeRoomMapViewport(rid, { ...place.location, zoom: PLACE_MAP_ZOOM });
      }
      router.push(MOBILE_MAP_PATH);
    },
    [isMobileDevice, pathname, roomId, router, searchParams, setSelectedPlace],
  );
}
