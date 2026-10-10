"use client";

import { useEffect, useRef } from "react";

import { HeroImage, HeroSkeleton } from "@/components/place/HeroSection";
import { PlaceDetailTabs } from "@/components/place/PlaceDetailTabs";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { AnalyticsEvents, trackAnalyticsEvent, type AnalyticsSource } from "@/lib/analytics/track";
import { normalizeGooglePlaceResourceId } from "@/lib/maps";
import type { PlanPlace } from "@/lib/plan/types";

/**
 * 펼친 경로 카드의 상세(Figma ④) — 사진, 홈·리뷰 탭(장소 상세 시트와 같음).
 * 시간·비용·메모는 카드 윗부분에 그대로 있다. 가운데 카드(`active`)일 때만 상세를 불러온다.
 * 지도에서 고른 후보 장소도 같은 상세를 쓴다(`analyticsSource="map"`).
 */
export function MobileRoutePlaceDetail({
  place,
  active,
  analyticsSource = "plan",
}: Readonly<{
  place: Pick<PlanPlace, "googlePlaceId" | "title" | "subtitle" | "location" | "imageUrl" | "primaryTypeDisplayName">;
  active: boolean;
  analyticsSource?: AnalyticsSource;
}>) {
  const rawId = place.googlePlaceId?.trim() ?? "";
  const googlePlaceId = rawId ? normalizeGooglePlaceResourceId(rawId) : undefined;
  const { data: detail, isLoading } = usePlaceDetailData(active ? googlePlaceId : undefined);
  const category = detail?.primaryTypeDisplayName ?? place.primaryTypeDisplayName ?? "";

  // 일정 상세를 본 것으로 한 번만 기록한다(장소 상세 패널과 같은 이벤트)
  const trackedPlaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !googlePlaceId || isLoading || trackedPlaceIdRef.current === googlePlaceId) return;
    trackedPlaceIdRef.current = googlePlaceId;
    trackAnalyticsEvent(AnalyticsEvents.viewPlace, { place_category: category, interaction_source: analyticsSource });
  }, [active, analyticsSource, category, googlePlaceId, isLoading]);

  const showSkeleton = !active || (isLoading && !detail);

  return (
    <div className="flex flex-col">
      <div className="mx-3.5 h-[130px] overflow-hidden rounded-md bg-fill">
        {showSkeleton ? (
          <HeroSkeleton />
        ) : (
          <HeroImage googlePlaceId={googlePlaceId} fallbackImage={place.imageUrl} name={place.title} />
        )}
      </div>

      {showSkeleton ? (
        <output aria-label="장소 정보 불러오는 중" aria-busy className="mt-3 flex flex-col gap-2 px-5 py-4">
          <span className="h-5 w-24 animate-pulse rounded bg-fill-strong" />
          <span className="h-16 w-full animate-pulse rounded-md bg-fill" />
        </output>
      ) : (
        // 장소 상세 시트와 같은 홈·리뷰 탭 — 같은 상세 응답을 쓰므로 추가 호출이 없다
        <div className="mt-3">
          <PlaceDetailTabs
            home={{
              isOpen: detail?.openNow,
              address: place.subtitle ?? detail?.formattedAddress,
              phone: detail?.phone,
              hours: detail?.weekdayDescriptions?.join("\n"),
              website: detail?.websiteUri,
              googleMapsUrl: detail?.placeUri ?? undefined,
              reviewSummary: detail?.reviewSummary,
            }}
            reviews={{
              rating: detail?.rating ?? null,
              userRatingCount: detail?.userRatingCount,
              reviews: detail?.reviews ?? [],
              reviewsUri: detail?.reviewsUri,
            }}
          />
        </div>
      )}

    </div>
  );
}
