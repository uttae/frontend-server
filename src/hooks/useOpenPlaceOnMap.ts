"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import {
  useSelectedPlace,
  type SetSelectedPlaceOptions,
} from "@/contexts/SelectedPlaceContext";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { writeRoomMapViewport } from "@/lib/map-room-viewport-storage";
import { isMobileMapPathname, MOBILE_MAP_PATH } from "@/lib/mobile-view";
import type { SearchResultCardProps } from "@/types/place";

/** 모바일에서 지도가 처음 열릴 때의 줌 — 장소 선택 시 카메라(`SelectedPlaceController`)와 같다 */
const PLACE_MAP_ZOOM = 16;

/**
 * 일정·채팅·북마크·검색 등 지도 밖에서 장소를 연다.
 * - 데스크톱: 지도가 항상 옆에 있어 장소만 선택한다.
 * - 모바일: 지도 화면으로 이동해 장소 시트를 열고, 시트의 뒤로가기는 원래 화면으로 돌아온다.
 */
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

      // 방 지도 위치를 장소로 저장해 두면 지도가 처음부터 그 장소에서 열린다(여행지 위치로 덮어쓰지 않음).
      // 좌표가 없으면 지도는 마지막 위치에서 열리고 시트만 뜬다.
      const rid = typeof roomId === "string" ? roomId.trim() : "";
      if (rid && place.location) {
        writeRoomMapViewport(rid, { ...place.location, zoom: PLACE_MAP_ZOOM });
      }
      router.push(MOBILE_MAP_PATH);
    },
    [isMobileDevice, pathname, roomId, router, searchParams, setSelectedPlace],
  );
}
