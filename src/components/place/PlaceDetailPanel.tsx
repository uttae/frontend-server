"use client";

import { ArrowLeft, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
} from "react";
import { toast } from "sonner";

import { ChevronLeftIcon, CloseIcon } from "@/assets/icons";
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

const SCROLL_AREA_BASE_CLASS =
  "min-h-0 flex-1 overscroll-contain [scrollbar-color:rgba(0,0,0,0.15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/[0.15] [&::-webkit-scrollbar-track]:bg-transparent";
const SCROLL_AREA_CLASS = cn(SCROLL_AREA_BASE_CLASS, "overflow-y-auto");

/** Figma 기준 peek 높이(핸들~사진) — 실측 전 초기값 */
const SHEET_PEEK_FALLBACK_PX = 412;
/** 이 거리(px) 이상 밀어야 펼침/접힘으로 전환 */
const SHEET_EXPAND_SWIPE_PX = 24;
const SHEET_COLLAPSE_SWIPE_PX = 48;

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
            {renderHero("h-[200px]")}
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

type PlaceDetailSheetProps = {
  /** 바뀌면 다시 peek 상태로 시작한다 */
  placeKey: string;
  onBack: () => void;
  onClose: () => void;
  /** 처음 보이는 영역 — 장소 정보·버튼·사진 */
  peek: ReactNode;
  children: ReactNode;
};

/**
 * 모바일 바텀 시트 — 처음엔 `peek`(사진)까지만 보이고, 위로 밀면 컨테이너 끝까지 펼쳐진다.
 * 펼쳐진 상태에서 본문 맨 위에서 아래로 밀거나 핸들을 누르면 다시 접힌다.
 */
function PlaceDetailSheet({
  placeKey,
  onBack,
  onClose,
  peek,
  children,
}: PlaceDetailSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [peekHeight, setPeekHeight] = useState(SHEET_PEEK_FALLBACK_PX);
  const headerRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ y: number; atTop: boolean } | null>(null);

  const [previousPlaceKey, setPreviousPlaceKey] = useState(placeKey);
  if (previousPlaceKey !== placeKey) {
    setPreviousPlaceKey(placeKey);
    setExpanded(false);
  }

  useEffect(() => {
    const header = headerRef.current;
    const peekEl = peekRef.current;
    if (!header || !peekEl) return;
    const measure = () => setPeekHeight(header.offsetHeight + peekEl.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(peekEl);
    return () => observer.disconnect();
  }, []);

  const collapse = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setExpanded(false);
  }, []);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    // 헤더에서 시작했거나 본문이 맨 위일 때만 아래로 밀어 접을 수 있다
    const fromHeader = headerRef.current?.contains(e.target as Node) ?? false;
    touchStartRef.current = {
      y: e.touches[0].clientY,
      atTop: fromHeader || (scrollRef.current?.scrollTop ?? 0) <= 0,
    };
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const dy = e.changedTouches[0].clientY - start.y;
    if (!expanded && dy < -SHEET_EXPAND_SWIPE_PX) setExpanded(true);
    else if (expanded && start.atTop && dy > SHEET_COLLAPSE_SWIPE_PX) collapse();
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    if (!expanded && e.deltaY > 0) setExpanded(true);
    else if (expanded && e.deltaY < 0 && (scrollRef.current?.scrollTop ?? 0) <= 0) collapse();
  }

  return (
    <div
      className={cn(
        "pointer-events-auto absolute inset-x-0 bottom-0 flex h-full flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-6px_24px_-4px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out",
        !expanded && "touch-none",
      )}
      style={
        expanded
          ? undefined
          : { transform: `translateY(max(0px, calc(100% - ${peekHeight}px)))` }
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div ref={headerRef} className="shrink-0">
        <button
          type="button"
          onClick={() => (expanded ? collapse() : setExpanded(true))}
          aria-label={expanded ? "장소 정보 접기" : "장소 정보 펼치기"}
          aria-expanded={expanded}
          className="flex h-3 w-full items-end justify-center"
        >
          <span className="h-[3px] w-10 rounded-full bg-icon-disabled" />
        </button>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로가기"
            className="flex size-12 items-center justify-center"
          >
            <ChevronLeftIcon className="text-icon" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-12 items-center justify-center"
          >
            <CloseIcon className="text-icon" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          SCROLL_AREA_BASE_CLASS,
          expanded ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        <div ref={peekRef}>{peek}</div>
        {children}
      </div>
    </div>
  );
}
