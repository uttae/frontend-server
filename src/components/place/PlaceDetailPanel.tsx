"use client";

import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useChat } from "@/hooks/useChat";
import { useChatActions } from "@/hooks/useChatActions";
import {
  AnalyticsEvents,
  trackAnalyticsEvent,
  type ItinerarySource,
} from "@/lib/analytics/track";

import type { SearchResultCardProps } from "./SearchResultCard";
import { AddToBookmarkModal } from "./AddToBookmarkModal";
import { AddToScheduleModal } from "./AddToScheduleModal";
import { TABS, type Tab } from "./types";
import { usePlaceDetailData } from "./usePlaceDetailData";
import { HeroSkeleton, HeroImage } from "./HeroSection";
import { PlaceSummaryHeader } from "./PlaceSummaryHeader";
import { HomeTab } from "./HomeTab";
import { ReviewsTab } from "./ReviewsTab";

type PlaceDetailPanelProps = SearchResultCardProps & {
  onClose: () => void;
};

export function PlaceDetailPanel({
  name,
  category,
  reviewSummary: propReviewSummary,
  rating,
  userRatingCount: propUserRatingCount,
  isOpen: propIsOpen,
  image,
  address,
  location,
  googlePlaceId,
  onClose,
}: PlaceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("홈");
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const {
    analyticsRankBucketRef,
    analyticsSourceRef,
    itinerarySourceRef,
  } = useSelectedPlace();
  const { sendPlaceMessage, canSend } = useChatActions();
  const { openChat } = useChat();

  const itinerarySource: ItinerarySource =
    itinerarySourceRef.current ?? "search";

  const { data: detailData, isLoading: isDetailLoading } =
    usePlaceDetailData(googlePlaceId);

  const displayName =
    (detailData?.name && detailData.name.trim().length > 0
      ? detailData.name
      : name) || name;
  const displayCategory =
    (detailData?.primaryTypeDisplayName &&
    detailData.primaryTypeDisplayName.trim().length > 0
      ? detailData.primaryTypeDisplayName
      : category) || category;
  const lastTrackedPlaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    const placeId = googlePlaceId?.trim();
    if (!placeId) {
      lastTrackedPlaceIdRef.current = null;
      return;
    }
    if (isDetailLoading || lastTrackedPlaceIdRef.current === placeId) {
      return;
    }
    lastTrackedPlaceIdRef.current = placeId;
    trackAnalyticsEvent(AnalyticsEvents.viewPlace, {
      place_category: displayCategory,
      rank_bucket: analyticsRankBucketRef.current ?? undefined,
      interaction_source: analyticsSourceRef.current ?? itinerarySource,
    });
  }, [
    analyticsRankBucketRef,
    analyticsSourceRef,
    displayCategory,
    googlePlaceId,
    isDetailLoading,
    itinerarySource,
  ]);
  const displayRating = detailData?.rating ?? rating;

  const handleSendToChat = useCallback(() => {
    if (!googlePlaceId?.trim()) {
      toast.error("장소 정보를 확인할 수 없어요.");
      return;
    }
    if (!canSend) {
      toast.error("채팅 연결을 확인해주세요.");
      return;
    }
    const loc = location ?? detailData?.location;
    if (!loc) {
      toast.error("위치 정보가 없어 채팅으로 보낼 수 없어요.");
      return;
    }
    sendPlaceMessage({
      googlePlaceId: googlePlaceId.trim(),
      name: displayName,
      formattedAddress: address ?? detailData?.formattedAddress ?? "",
      latitude: loc.lat,
      longitude: loc.lng,
      rating: displayRating ?? 0,
    });
    toast.success("장소를 채팅으로 보냈어요");
    openChat();
  }, [
    address,
    canSend,
    detailData?.formattedAddress,
    detailData?.location,
    displayName,
    displayRating,
    googlePlaceId,
    location,
    openChat,
    sendPlaceMessage,
  ]);

  const phone = detailData?.phone;
  const website = detailData?.websiteUri;
  const hours = detailData?.weekdayDescriptions?.join("\n");
  const openNow = detailData?.openNow ?? propIsOpen;
  const userRatingCount = detailData?.userRatingCount ?? propUserRatingCount;
  const reviewSummary = detailData?.reviewSummary ?? propReviewSummary;
  const reviews = detailData?.reviews ?? [];
  const displayAddress = address ?? detailData?.formattedAddress;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Hero */}
      <div className="relative h-[185px] shrink-0">
        {isDetailLoading && googlePlaceId ? (
          <HeroSkeleton />
        ) : (
          <HeroImage
            googlePlaceId={googlePlaceId}
            fallbackImage={image}
            name={displayName}
          />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="뒤로가기"
          className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="닫기"
          className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent">
        <PlaceSummaryHeader
          name={displayName}
          category={displayCategory}
          rating={displayRating}
          userRatingCount={userRatingCount}
          onSendToChat={googlePlaceId ? handleSendToChat : undefined}
          sendToChatDisabled={
            !googlePlaceId ||
            (!location && !detailData?.location && isDetailLoading)
          }
          onAddToSchedule={
            googlePlaceId
              ? () => setScheduleModalOpen(true)
              : undefined
          }
          addToScheduleDisabled={!googlePlaceId}
          onAddBookmark={
            googlePlaceId
              ? () => setBookmarkModalOpen(true)
              : undefined
          }
          addBookmarkDisabled={!googlePlaceId}
        />

        {/* Tab navigation */}
        <div className="flex shrink-0 border-b border-gray-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-dark-gray hover:text-[#364153]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "홈" && (
          <HomeTab
            isOpen={openNow}
            address={displayAddress}
            phone={phone}
            hours={hours}
            website={website}
            googleMapsUrl={detailData?.placeUri ?? undefined}
            reviewSummary={reviewSummary}
          />
        )}
        {activeTab === "리뷰" && (
          <ReviewsTab
            rating={displayRating}
            userRatingCount={userRatingCount}
            reviews={reviews}
            reviewsUri={detailData?.reviewsUri}
          />
        )}
      </div>

      {scheduleModalOpen && googlePlaceId && (
        <AddToScheduleModal
          googlePlaceId={googlePlaceId}
          placeCategory={displayCategory}
          source={itinerarySource}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}

      {bookmarkModalOpen && googlePlaceId && (
        <AddToBookmarkModal
          googlePlaceId={googlePlaceId}
          placeCategory={displayCategory}
          source={itinerarySource}
          onClose={() => setBookmarkModalOpen(false)}
        />
      )}
    </div>
  );
}
