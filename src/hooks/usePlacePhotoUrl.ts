import { useQuery } from "@tanstack/react-query";

import {
  loadPlacePhotoUrl,
  placePhotoUrlQueryDefaults,
  placePhotoUrlQueryKey,
} from "@/lib/place-photo-query";

/** 장소 사진 주소 조회 옵션 — useQuery 밖에서도 같은 키·queryFn·캐시 설정을 쓰게 한다 */
export function placePhotoUrlQueryOptions(
  googlePlaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return {
    queryKey: placePhotoUrlQueryKey(id),
    queryFn: () => loadPlacePhotoUrl(id),
    enabled: id.length > 0 && (options?.enabled ?? true),
    ...placePhotoUrlQueryDefaults,
  };
}

export function usePlacePhotoUrlQuery(
  googlePlaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery(placePhotoUrlQueryOptions(googlePlaceId, options));
}
