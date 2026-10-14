import { useQuery } from "@tanstack/react-query";

import { requestPlaceDetail, type PlaceDetail } from "@/lib/api/places";
import {
  placeDetailQueryKey,
  placeDetailQueryDefaults,
} from "@/lib/places/place-queries";
import type { PlaceDetailResult } from "./types";

export function toPlaceDetailResult(detail: PlaceDetail): PlaceDetailResult {
  return {
    name: detail.name,
    primaryTypeDisplayName: detail.primaryTypeDisplayName,
    rating: detail.rating,
    formattedAddress: detail.formattedAddress,
    location: detail.location,
    phone: detail.phoneNumber,
    websiteUri: detail.websiteUri,
    placeUri: detail.googleMapsLinks?.placeUri ?? null,
    reviewsUri: detail.googleMapsLinks?.reviewsUri ?? null,
    openNow: detail.regularOpeningHours?.openNow ?? null,
    weekdayDescriptions: detail.regularOpeningHours?.weekdayDescriptions ?? [],
    userRatingCount: detail.userRatingCount,
    reviewSummary: detail.reviewSummary,
    reviews: detail.reviews ?? [],
  };
}

export function usePlaceDetailData(googlePlaceId?: string) {
  const id = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  return useQuery<PlaceDetail, Error, PlaceDetailResult>({
    queryKey: placeDetailQueryKey(id),
    queryFn: () => requestPlaceDetail(id),
    select: toPlaceDetailResult,
    enabled: id.length > 0,
    ...placeDetailQueryDefaults,
  });
}
