"use client";

import { Star, MapPin } from "lucide-react";
import { useInViewport } from "@/hooks/useInViewport";
import { usePlacePhotoUrlQuery } from "@/hooks/usePlacePhotoUrl";
import type { SearchResultCardProps } from "@/types/place";
import { handlePlacePhotoImageError } from "@/lib/places/place-photo-refresh";
import { cn } from "@/lib/utils";

export type { SearchResultCardProps } from "@/types/place";

function SearchResultThumbnail({
  name,
  image,
  googlePlaceId,
  variant,
}: Pick<SearchResultCardProps, "name" | "image" | "googlePlaceId"> & {
  variant: "list" | "tile";
}) {
  const [thumbnailRef, thumbnailInViewport] = useInViewport<HTMLDivElement>();
  const { data: lazyImage } = usePlacePhotoUrlQuery(googlePlaceId, {
    enabled: thumbnailInViewport && !image,
  });
  const resolvedImage = image ?? lazyImage;

  return (
    <div
      ref={thumbnailRef}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg bg-light-gray",
        variant === "tile" ? "h-[80px] w-[80px]" : "h-[88px] w-[88px]",
      )}
    >
      {resolvedImage ? (
        <img
          src={resolvedImage}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) =>
            handlePlacePhotoImageError({
              source: "search-result-card",
              googlePlaceId,
              placeName: name,
              image: event.currentTarget,
            })
          }
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <MapPin className="h-6 w-6 text-gray-300" />
        </div>
      )}
    </div>
  );
}

export function SearchResultCard({
  name,
  category,
  rating,
  userRatingCount,
  isOpen,
  image,
  address,
  googlePlaceId,
  onClick,
  className,
  variant = "list",
  showThumbnail = true,
}: SearchResultCardProps & {
  onClick?: () => void;
  className?: string;
  variant?: "list" | "tile";
  showThumbnail?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex items-center gap-3 bg-white transition-colors",
        variant === "tile"
          ? "cursor-pointer rounded-2xl border border-gray-border px-4 py-3 shadow-sm hover:bg-gray-50 active:bg-bubble-gray/60"
          : "border-b border-gray-border px-5 py-3 hover:bg-gray-50 active:bg-gray-100",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={onClick && variant === "list" ? { cursor: "pointer" } : undefined}
    >
      {/* Text content */}
      <div className="min-w-0 flex-1">
        {/* 이름 + 유형 */}
        <div className="flex items-baseline gap-1.5">
          <h3 className="truncate text-[17px] font-semibold leading-5 tracking-tight text-primary-strong">
            {name}
          </h3>
          {category && (
            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium leading-none text-dark-gray">
              {category}
            </span>
          )}
        </div>

        {/* 별점 + 리뷰 수 + 영업 상태 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5">
          <Star className="h-3 w-3 fill-[#FDC700] text-[#FDC700]" />
          <span className="text-[13px] font-medium leading-relaxed text-[#364153]">
            {rating != null ? rating.toFixed(1) : "-"}
          </span>
          {userRatingCount != null && (
            <span className="text-[13px] leading-relaxed text-[#99A1AF]">
              ({userRatingCount.toLocaleString()})
            </span>
          )}
          {isOpen !== undefined && (
            <span
              className={`text-[13px] font-medium leading-relaxed ${
                isOpen ? "text-primary" : "text-status-negative"
              }`}
            >
              · {isOpen ? "영업 중" : "영업 종료"}
            </span>
          )}
        </div>

        {/* 주소 */}
        {address && (
          <div className="mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-[#99A1AF]" />
            <span className="truncate text-[13px] leading-relaxed text-[#99A1AF]">
              {address}
            </span>
          </div>
        )}
      </div>

      {showThumbnail ? (
        <SearchResultThumbnail
          name={name}
          image={image}
          googlePlaceId={googlePlaceId}
          variant={variant}
        />
      ) : null}
    </article>
  );
}
