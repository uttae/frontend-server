"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { useAnalyticsRoomId } from "@/hooks/useAnalyticsRoomId";
import { useMobileView } from "@/contexts/MobileViewContext";
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
import { usePlaceDetailData } from "./usePlaceDetailData";
import { HeroSkeleton, HeroImage } from "./HeroSection";
import { PlaceDetailSkeleton, PlaceSheetSummarySkeleton } from "./PlaceDetailSkeleton";
import { PlaceDetailSheet } from "./PlaceDetailSheet";
import { PlaceSheetSummary } from "./PlaceSheetSummary";
import { PlaceSummaryHeader } from "./PlaceSummaryHeader";
import { PlaceDetailTabs } from "./PlaceDetailTabs";

type PlaceDetailPanelProps = SearchResultCardProps & {
  onClose: () => void;
  onBack?: () => void;
  layout?: "panel" | "sheet";
};

const SHEET_PHOTO_HEIGHT_PX = 200;
const SHEET_PHOTO_HIDDEN_RATIO = 3 / 5;

const SCROLL_AREA_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent";

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
  const analyticsRoomId = useAnalyticsRoomId();
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const {
    analyticsRankBucket,
    analyticsRankPending,
    analyticsSource,
    itinerarySource: selectedItinerarySource,
  } = useSelectedPlace();
  const { sendPlaceMessage, canSend } = useChatActions();
  const { chatState, openChat } = useChat();
  const { isMobileDevice } = useMobileView();

  const itinerarySource = selectedItinerarySource ?? "search";

  const { data: detailData, isLoading: isDetailLoading, isError: isDetailError, refetch } =
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
    if (isDetailLoading || isDetailError || analyticsRankPending || lastTrackedPlaceIdRef.current === placeId) {
      return;
    }
    lastTrackedPlaceIdRef.current = placeId;
    trackAnalyticsEvent(AnalyticsEvents.viewPlace, {
      ...(analyticsRoomId ? { room_id: analyticsRoomId } : {}),
      place_category: displayCategory,
      rank_bucket: analyticsRankBucket ?? undefined,
      interaction_source: analyticsSource ?? itinerarySource,
    });
  }, [
    analyticsRankBucket,
    analyticsRankPending,
    analyticsSource,
    analyticsRoomId,
    displayCategory,
    googlePlaceId,
    isDetailLoading,
    isDetailError,
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
    if (!isMobileDevice && chatState === "closed") openChat();
  }, [
    address,
    canSend,
    chatState,
    detailData?.formattedAddress,
    detailData?.location,
    displayName,
    displayRating,
    googlePlaceId,
    isMobileDevice,
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

  const tabs = isDetailError && !detailData ? (
    <div className="p-3.5">
      <Alert>
        <AlertTitle>장소 정보를 불러오지 못했어요.</AlertTitle>
        <AlertAction>
          <button type="button" onClick={() => void refetch()} className="text-primary underline">다시 시도</button>
        </AlertAction>
      </Alert>
    </div>
  ) : (
    <PlaceDetailTabs
      home={{
        isOpen: openNow,
        address: displayAddress,
        phone,
        hours,
        website,
        googleMapsUrl: detailData?.placeUri ?? undefined,
        reviewSummary,
      }}
      reviews={{
        rating: displayRating,
        userRatingCount,
        reviews,
        reviewsUri: detailData?.reviewsUri,
      }}
    />
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
