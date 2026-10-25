import { useQuery } from "@tanstack/react-query";

import {
  loadPlacePhotoUrl,
  placePhotoUrlQueryDefaults,
  placePhotoUrlQueryKey,
} from "@/lib/place-photo-query";

export function usePlacePhotoUrlQuery(
  googlePlaceId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return useQuery({
    queryKey: placePhotoUrlQueryKey(id),
    queryFn: () => loadPlacePhotoUrl(id),
    enabled: id.length > 0 && (options?.enabled ?? true),
    ...placePhotoUrlQueryDefaults,
  });
}
