"use client";

import { MapPin, Star } from "lucide-react";

import { useInViewport } from "@/hooks/useInViewport";
import { usePlacePhotoUrlQuery } from "@/hooks/usePlacePhotoUrl";
import { resolveChatMessageTypography } from "@/components/chat/chat-typography";
import { handlePlacePhotoImageError } from "@/lib/places/place-photo-refresh";
import { cn } from "@/lib/utils";

export type OgPlacePreviewCardProps = {
  name: string;
  formattedAddress: string;
  googlePlaceId: string;
  /** Google 평점. null/omit 시 "-" */
  rating?: number | null;
  userRatingCount?: number | null;
  isMinimized?: boolean;
  onClick: () => void;
  className?: string;
};

export function OgPlacePreviewCard({
  name,
  formattedAddress,
  googlePlaceId,
  rating = null,
  userRatingCount,
  isMinimized = false,
  onClick,
  className,
}: OgPlacePreviewCardProps) {
  const typo = resolveChatMessageTypography(isMinimized);

  const [thumbnailRef, thumbnailInViewport] = useInViewport<HTMLDivElement>();
  const { data: imageUrl } = usePlacePhotoUrlQuery(googlePlaceId, {
    enabled: thumbnailInViewport,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer overflow-hidden rounded-xl border border-gray-border bg-white text-left shadow-sm transition hover:border-primary/40 hover:shadow-md",
        isMinimized ? "w-full max-w-[228px]" : "w-[260px]",
        className,
      )}
    >
      <div
        ref={thumbnailRef}
        className={cn(
          "shrink-0 overflow-hidden bg-light-gray",
          isMinimized ? "h-[72px] w-[72px]" : "h-[88px] w-[88px]",
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 동적 장소 사진 URL (원격 패턴 비고정)
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) =>
              handlePlacePhotoImageError({
                source: "chat-og-place-card",
                googlePlaceId,
                placeName: name,
                image: event.currentTarget,
              })
            }
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin
              className={cn(
                "text-gray-300",
                isMinimized ? "h-5 w-5" : "h-6 w-6",
              )}
            />
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center",
          isMinimized ? "gap-0.5 px-2 py-1.5" : "gap-1 px-3 py-2",
        )}
      >
        <div className={cn("truncate", typo.placeTitle)}>{name}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0">
          <Star
            className={cn(
              "shrink-0 fill-[#FDC700] text-[#FDC700]",
              isMinimized ? "h-2.5 w-2.5" : "h-3 w-3",
            )}
          />
          <span className={typo.placeRating}>
            {rating != null && Number.isFinite(rating)
              ? rating.toFixed(1)
              : "-"}
          </span>
          {userRatingCount != null && Number.isFinite(userRatingCount) ? (
            <span className={cn("shrink-0", typo.placeAddress)}>
              ({Math.round(userRatingCount).toLocaleString()})
            </span>
          ) : null}
        </div>
        {formattedAddress ? (
          <div className="flex items-center gap-1">
            <MapPin
              className={cn(
                "shrink-0 text-[#99A1AF]",
                isMinimized ? "h-2.5 w-2.5" : "h-3 w-3",
              )}
            />
            <span className={cn("truncate", typo.placeAddress)}>
              {formattedAddress}
            </span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
