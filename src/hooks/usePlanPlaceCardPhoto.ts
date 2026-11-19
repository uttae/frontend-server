import { usePlacePhotoUrlQuery } from "@/hooks/usePlacePhotoUrl";
import type { PlanPlace } from "@/lib/plan/types";

export function usePlanPlaceCardPhoto(place: PlanPlace, options?: { enabled?: boolean }) {
  const fallbackPhotoUrl =
    typeof place.imageUrl === "string" && place.imageUrl.trim().length > 0 ? place.imageUrl.trim() : null;
  const googlePlaceId =
    typeof place.googlePlaceId === "string" && place.googlePlaceId.trim().length > 0
      ? place.googlePlaceId.trim()
      : null;

  const photoQuery = usePlacePhotoUrlQuery(googlePlaceId, {
    enabled: options?.enabled ?? true,
  });

  const resolvedPhotoUrl = googlePlaceId ? photoQuery.data?.trim() || fallbackPhotoUrl : fallbackPhotoUrl;

  return {
    resolvedPhotoUrl,
    photoLoading: Boolean(googlePlaceId) && photoQuery.isLoading && !resolvedPhotoUrl,
  };
}
