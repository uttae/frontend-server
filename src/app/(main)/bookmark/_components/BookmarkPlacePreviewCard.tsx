"use client";

import { MapPin } from "lucide-react";

import { useInViewport } from "@/hooks/useInViewport";
import { usePlacePhotoUrlQuery } from "@/hooks/usePlacePhotoUrl";
import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { handlePlacePhotoImageError } from "@/lib/places/place-photo-refresh";
import {
  buildGoogleMapsPlaceUrl,
  normalizeGooglePlaceResourceId,
} from "@/lib/maps";
import { cn } from "@/lib/utils";

export type BookmarkPlacePreviewCardProps = {
  name: string;
  address?: string;
  primaryTypeDisplayName?: string;
  /** 있으면 사진 클릭 시 Google Maps로 이동 */
  googlePlaceId?: string;
  onClick?: () => void;
  className?: string;
  contentClassName?: string;
};

export function BookmarkPlacePreviewCard({
  name,
  address,
  primaryTypeDisplayName,
  googlePlaceId,
  onClick,
  className,
  contentClassName,
}: BookmarkPlacePreviewCardProps) {
  const [thumbnailRef, thumbnailInViewport] = useInViewport<HTMLElement>();
  const { data: imageUrl } = usePlacePhotoUrlQuery(googlePlaceId, {
    enabled: thumbnailInViewport,
  });

  const rawGid = typeof googlePlaceId === "string" ? googlePlaceId.trim() : "";
  const googleMapsPlaceUrl = rawGid.length
    ? buildGoogleMapsPlaceUrl({
        placeId: normalizeGooglePlaceResourceId(rawGid),
        query: name,
      })
    : null;

  const thumbnailMedia = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote place photo URL
    <img
      src={imageUrl}
      alt={name}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={(event) =>
        handlePlacePhotoImageError({
          source: "bookmark-preview-card",
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
  );

  return (
    <article
      className={cn(
        "flex items-center gap-3 bg-white transition-colors",
        "border-b border-gray-border py-2 hover:bg-gray-50 active:bg-gray-100",
        MAIN_CARD_INNER_PADDING_X_CLASS,
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className={cn("min-w-0 flex-1", contentClassName)}>
        <div className="flex items-baseline gap-1.5">
          <h3 className="truncate text-[17px] font-semibold leading-5 tracking-tight text-primary mobile:text-[15px]">
            {name}
          </h3>
          {primaryTypeDisplayName ? (
            <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium leading-none text-dark-gray">
              {primaryTypeDisplayName}
            </span>
          ) : null}
        </div>
        {address ? (
          <div className="mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-[#99A1AF]" />
            <span className="truncate text-[13px] leading-relaxed text-[#99A1AF]">
              {address}
            </span>
          </div>
        ) : null}
      </div>

      {googleMapsPlaceUrl ? (
        <a
          ref={thumbnailRef}
          href={googleMapsPlaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`${name} — Google Maps에서 열기`}
          className="relative block h-[80px] w-[80px] shrink-0 cursor-pointer overflow-hidden rounded-lg bg-light-gray transition hover:brightness-105"
          draggable={false}
        >
          {thumbnailMedia}
          <span
            className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white shadow-sm ring-1 ring-white/25"
            aria-hidden
          >
            <MapPin className="h-3 w-3" strokeWidth={2.4} />
          </span>
        </a>
      ) : (
        <div
          ref={thumbnailRef}
          className="h-[80px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-light-gray"
        >
          {thumbnailMedia}
        </div>
      )}
    </article>
  );
}
