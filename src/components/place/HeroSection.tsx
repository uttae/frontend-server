"use client";

import { usePlacePhotoUrlQuery } from "@/hooks/usePlacePhotoUrl";
import { handlePlacePhotoImageError } from "@/lib/places/place-photo-refresh";

export function HeroSkeleton() {
  return <div className="h-full animate-pulse bg-gray-200" />;
}

export function HeroImage({
  googlePlaceId,
  fallbackImage,
  name,
}: {
  googlePlaceId?: string;
  fallbackImage?: string;
  name: string;
}) {
  const { data: queriedPhotoUrl, isLoading } = usePlacePhotoUrlQuery(googlePlaceId);
  const photoUrl = queriedPhotoUrl || fallbackImage || null;

  if (!photoUrl && isLoading) {
    return <HeroSkeleton />;
  }

  if (!photoUrl) {
    return <div className="h-full bg-light-gray" />;
  }

  return (
    <div className="h-full overflow-hidden">
      <img
        src={photoUrl}
        alt={name}
        className="h-full w-full object-cover"
        onError={(event) =>
          handlePlacePhotoImageError({
            source: "place-hero",
            googlePlaceId,
            placeName: name,
            image: event.currentTarget,
          })
        }
      />
    </div>
  );
}
