"use client";

import { OgPlacePreviewCard } from "@/components/chat/messages/OgPlacePreviewCard";
import { ChatMarkdownContent } from "@/components/chat/ChatMarkdownContent";
import {
  chatAiBubblePlaceRecommendationHeadingSubtitleClass,
  chatAiBubblePlaceRecommendationHeadingTitleClass,
  chatAiBubblePlaceRecommendationReasonClass,
} from "@/components/chat/chat-typography";
import { useOpenPlaceOnMap } from "@/hooks/useOpenPlaceOnMap";
import { useMapCenterStore } from "@/stores/map-center-store";
import { stripRecommendedPlaceReasonPrefix } from "@/lib/recommended-place-reason";
import type {
  AiPlaceRecommendationHeading,
  AiRecommendedPlace,
} from "@/types/chat";
import { cn } from "@/lib/utils";

function AiRecommendedPlaceRow({
  place,
  isMinimized,
}: {
  place: AiRecommendedPlace;
  isMinimized: boolean;
}) {
  const openPlaceOnMap = useOpenPlaceOnMap();
  const setMapCenter = useMapCenterStore((s) => s.setMapCenter);

  const displayRating = place.rating ?? null;
  const displayReviewCount = place.userRatingCount ?? null;

  const reasonDisplay = place.reason
    ? stripRecommendedPlaceReasonPrefix(place.reason, place.placeId)
    : "";

  function handleClick() {
    setMapCenter({ lat: place.lat, lng: place.lng });
    openPlaceOnMap(
      {
        name: place.name,
        category: place.primaryType ?? "",
        rating: displayRating ?? null,
        userRatingCount: displayReviewCount,
        address: place.address,
        googlePlaceId: place.placeId,
        location: { lat: place.lat, lng: place.lng },
        image: undefined,
      },
      { analyticsSource: "chat" },
    );
  }

  return (
    <div className="flex max-w-full flex-col gap-1">
      <OgPlacePreviewCard
        name={place.name}
        formattedAddress={place.address}
        googlePlaceId={place.placeId}
        rating={displayRating}
        userRatingCount={displayReviewCount}
        isMinimized={isMinimized}
        onClick={handleClick}
      />
      {reasonDisplay ? (
        <p
          className={cn(
            "max-w-[260px]",
            isMinimized && "max-w-[228px]",
            chatAiBubblePlaceRecommendationReasonClass(isMinimized),
          )}
        >
          <ChatMarkdownContent text={reasonDisplay} variant="ai" />
        </p>
      ) : null}
    </div>
  );
}

export function AiRecommendedPlacesList({
  places,
  heading,
  isMinimized,
  className,
}: {
  places: AiRecommendedPlace[];
  heading?: AiPlaceRecommendationHeading;
  isMinimized: boolean;
  className?: string;
}) {
  if (!places.length) return null;

  const titleCls = chatAiBubblePlaceRecommendationHeadingTitleClass(isMinimized);
  const subtitleCls =
    chatAiBubblePlaceRecommendationHeadingSubtitleClass(isMinimized);

  return (
    <div
      className={cn(
        "mt-2 flex flex-col gap-2 border-t border-slate-300/80 pt-2",
        className,
      )}
    >
      {heading?.title ? (
        <div className={titleCls}>
          <ChatMarkdownContent text={heading.title} variant="ai" />
        </div>
      ) : null}
      {heading?.subtitle ? (
        <div className={subtitleCls}>
          <ChatMarkdownContent text={heading.subtitle} variant="ai" />
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        {places.map((p) => (
          <AiRecommendedPlaceRow
            key={`${p.placeId}-${p.name}`}
            place={p}
            isMinimized={isMinimized}
          />
        ))}
      </div>
    </div>
  );
}
