"use client";

import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { useChatActions } from "@/hooks/useChatActions";
import {
  AnalyticsEvents,
  trackAnalyticsEvent,
} from "@/lib/analytics/track";

import type { SearchResultCardProps } from "./SearchResultCard";
import { AddToBookmarkModal } from "./AddToBookmarkModal";
import { AddToScheduleModal } from "./AddToScheduleModal";
import { TABS, type Tab } from "./types";
import { usePlaceDetailData } from "./usePlaceDetailData";
import { HeroSkeleton, HeroImage } from "./HeroSection";
import { PlaceDetailSkeleton, PlaceSheetSummarySkeleton } from "./PlaceDetailSkeleton";
import { PlaceDetailSheet } from "./PlaceDetailSheet";
import { PlaceSheetSummary } from "./PlaceSheetSummary";
import { PlaceSummaryHeader } from "./PlaceSummaryHeader";
import { HomeTab } from "./HomeTab";
import { ReviewsTab } from "./ReviewsTab";

type PlaceDetailPanelProps = SearchResultCardProps & {
  onClose: () => void;
  /** 뒤로가기(←) — 없으면 `onClose`와 같다 */
  onBack?: () => void;
  /**
   * `panel`(데스크톱): 사진 고정, 아래 본문만 스크롤.
   * `sheet`(모바일 바텀 시트): 처음엔 사진까지만 보이고(peek), 위로 밀면 끝까지 펼쳐져 본문이 스크롤된다.
   */
  layout?: "panel" | "sheet";
};

/** 모바일 시트 사진 높이(Figma) — 중간 상태에서 이 중 3/5를 가린다 */
const SHEET_PHOTO_HEIGHT_PX = 200;
const SHEET_PHOTO_HIDDEN_RATIO = 3 / 5;

const SCROLL_AREA_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent";

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
  onBack = onClose,
  layout = "panel",
}: PlaceDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("홈");
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const {
    analyticsRankBucket,
    analyticsSource,
    itinerarySource: selectedItinerarySource,
  } = useSelectedPlace();
  const { sendPlaceMessage, canSend } = useChatActions();
  const { openChat } = useChat();

  const itinerarySource = selectedItinerarySource ?? "search";

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
      rank_bucket: analyticsRankBucket ?? undefined,
      interaction_source: analyticsSource ?? itinerarySource,
    });
  }, [
    analyticsRankBucket,
    analyticsSource,
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

  const shareUrl = detailData?.placeUri ?? null;
  const handleShare = useCallback(async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: displayName, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("장소 링크를 복사했어요");
    } catch {
      toast.error("장소 링크를 복사하지 못했어요.");
    }
  }, [displayName, shareUrl]);

  const phone = detailData?.phone;
  const website = detailData?.websiteUri;
  const hours = detailData?.weekdayDescriptions?.join("\n");
  const openNow = detailData?.openNow ?? propIsOpen;
  const userRatingCount = detailData?.userRatingCount ?? propUserRatingCount;
  const reviewSummary = detailData?.reviewSummary ?? propReviewSummary;
  const reviews = detailData?.reviews ?? [];
  const displayAddress = address ?? detailData?.formattedAddress;

  const isBodyLoading = isDetailLoading && !detailData;

  const renderHero = (heightClass: string) => (
    <div className={cn("relative shrink-0", heightClass)}>
      {isDetailLoading && googlePlaceId ? (
        <HeroSkeleton />
      ) : (
        <HeroImage
          googlePlaceId={googlePlaceId}
          fallbackImage={image}
          name={displayName}
        />
      )}
    </div>
  );

  const sendToChatDisabled =
    !googlePlaceId || (!location && !detailData?.location && isDetailLoading);
  const openScheduleModal = googlePlaceId
    ? () => setScheduleModalOpen(true)
    : undefined;
  const openBookmarkModal = googlePlaceId
    ? () => setBookmarkModalOpen(true)
    : undefined;

  const tabs = (
    <>
      {/* Tab navigation */}
      <div className="flex shrink-0 border-b border-gray-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-label-s-regular mobile:text-label-xs-regular font-medium transition-colors ${
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
    </>
  );

  const modals = (
    <>
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
    </>
  );

  if (layout === "sheet") {
    return (
      <PlaceDetailSheet
        placeKey={googlePlaceId ?? displayName}
        onBack={onBack}
        onClose={onClose}
        peekHiddenBottomPx={SHEET_PHOTO_HEIGHT_PX * SHEET_PHOTO_HIDDEN_RATIO}
        peek={
          <>
            {isBodyLoading ? (
              <PlaceSheetSummarySkeleton />
            ) : (
              <PlaceSheetSummary
                name={displayName}
                category={displayCategory}
                rating={displayRating}
                userRatingCount={userRatingCount}
                onShare={shareUrl ? () => void handleShare() : undefined}
                onAddBookmark={openBookmarkModal}
                onSendToChat={googlePlaceId ? handleSendToChat : undefined}
                sendToChatDisabled={sendToChatDisabled}
                onAddToSchedule={openScheduleModal}
              />
            )}
            <div style={{ height: SHEET_PHOTO_HEIGHT_PX }}>{renderHero("h-full")}</div>
          </>
        }
      >
        {isBodyLoading ? null : tabs}
        {modals}
      </PlaceDetailSheet>
    );
  }

  /* 상세 정보가 오기 전에는 임시 이름("장소")·빈 탭 대신 스켈레톤 — 느린 네트워크에서도 동작 중임을 알 수 있게 */
  const body = isBodyLoading ? (
    <PlaceDetailSkeleton />
  ) : (
    <>
      <PlaceSummaryHeader
        name={displayName}
        category={displayCategory}
        rating={displayRating}
        userRatingCount={userRatingCount}
        onSendToChat={googlePlaceId ? handleSendToChat : undefined}
        sendToChatDisabled={sendToChatDisabled}
        onAddToSchedule={openScheduleModal}
        addToScheduleDisabled={!googlePlaceId}
        onAddBookmark={openBookmarkModal}
        addBookmarkDisabled={!googlePlaceId}
      />
      {tabs}
    </>
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
      {renderHero("h-[185px]")}
      <div className={SCROLL_AREA_CLASS}>{body}</div>

      {/* 닫기 버튼 — 스크롤과 무관하게 패널 상단에 고정 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
        aria-label="뒤로가기"
        className="absolute left-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
        className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
      >
        <X className="h-4 w-4" />
      </button>

      {modals}
    </div>
  );
}
