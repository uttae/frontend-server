import { useQuery } from "@tanstack/react-query";

import {
  loadPlacePhotoUrl,
  placePhotoUrlQueryDefaults,
  placePhotoUrlQueryKey,
} from "@/lib/place-photo-query";

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
