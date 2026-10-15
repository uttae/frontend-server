export const TABS = ["홈", "리뷰"] as const;
export type Tab = (typeof TABS)[number];

export type { PlaceReview } from "@/lib/api/places";
import type { PlaceReview } from "@/lib/api/places";

export type PlaceDetailResult = {
  name: string | null;
  primaryTypeDisplayName: string | null;
  rating: number | null;
  formattedAddress: string | null;
  location: { lat: number; lng: number } | undefined;
  phone: string | null;
  websiteUri: string | null;
  placeUri: string | null;
  reviewsUri: string | null;
  openNow: boolean | null;
  weekdayDescriptions: string[];
  userRatingCount: number | null;
  reviewSummary: string | null;
  reviews: PlaceReview[];
};
