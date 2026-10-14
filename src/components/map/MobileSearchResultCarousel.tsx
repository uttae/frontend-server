"use client";

import type { SearchRankBucket } from "@/lib/analytics/context";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarAddIcon,
  ChatIcon,
  ReactionStarIcon,
  SavedIcon,
} from "@/assets/icons";
import { MobileRouteCardCarousel } from "@/app/(main)/map/_components/MobileRouteCardCarousel";
import { MobileRouteExpandedShell } from "@/app/(main)/map/_components/MobileRoutePlaceCard";
import { MobileRoutePlaceDetail } from "@/app/(main)/map/_components/MobileRoutePlaceDetail";
import { AddToBookmarkModal } from "@/components/place/AddToBookmarkModal";
import { AddToScheduleModal } from "@/components/place/AddToScheduleModal";
import { useChatActions } from "@/hooks/useChatActions";
import type { PlaceSearchResult } from "@/hooks/usePlacesSearch";
import { usePlaceSearchStore } from "@/stores/place-search-store";
import { cn } from "@/lib/utils";

export function MobileSearchResultCarousel() {
  const items = usePlaceSearchStore((s) => s.items);
  const searchRankBuckets = usePlaceSearchStore((s) => s.searchRankBuckets);
  const selectedId = usePlaceSearchStore((s) => s.selectedId);
  const expanded = usePlaceSearchStore((s) => s.expanded);
  const select = usePlaceSearchStore((s) => s.select);
  const setExpanded = usePlaceSearchStore((s) => s.setExpanded);
  if (!items.length) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-3 z-20 transition-[height]",
        expanded ? "h-[70%]" : "h-[145px]",
      )}
    >
      <MobileRouteCardCarousel
        focusedKey={selectedId}
        onFocusChange={(index) => {
          const item = items[index];
          if (item) select(item.googlePlaceId);
        }}
        cards={items.map((item) => ({
          key: item.googlePlaceId,
          node: (
            <SearchPlaceCard
              item={item}
              analyticsRankBucket={searchRankBuckets[item.googlePlaceId]}
              expanded={expanded}
              active={selectedId === item.googlePlaceId}
              onExpand={() => {
                select(item.googlePlaceId);
                setExpanded(true);
              }}
              onCollapse={() => setExpanded(false)}
            />
          ),
        }))}
      />
    </div>
  );
}

function SearchPlaceCard({
  item,
  analyticsRankBucket,
  expanded,
  active,
  onExpand,
  onCollapse,
}: {
  item: PlaceSearchResult;
  analyticsRankBucket?: SearchRankBucket;
  expanded: boolean;
  active: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const [modal, setModal] = useState<"bookmark" | "schedule" | null>(null);
  const { canSend, sendPlaceMessage } = useChatActions();
  const summary = (
    <div className="relative min-h-[145px] p-2.5">
      {!expanded ? (
        <button
          type="button"
          aria-label={`${item.name} 상세 보기`}
          onClick={onExpand}
          className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
        />
      ) : null}
      <div className="pointer-events-none relative flex min-h-[125px] flex-col gap-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="truncate text-[18px] font-bold leading-6 text-text">
              {item.name}
            </h3>
            {item.category ? (
              <p className="text-[12px] leading-4 text-text-subtle">
                {item.category}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={`${item.name} 북마크에 추가`}
            onClick={() => setModal("bookmark")}
            className="pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle"
          >
            <SavedIcon size={18} className="text-primary" />
          </button>
        </div>
        {item.rating != null ? (
          <div className="flex items-center gap-1">
            <ReactionStarIcon
              size={14}
              className="fill-current text-[var(--orange-500)] [&_path]:stroke-none"
            />
            <span className="text-[12px] font-bold leading-4 text-text">
              {item.rating.toFixed(1)}
            </span>
            {item.userRatingCount != null ? (
              <span className="text-[11px] leading-4 text-text-subtle">
                ({item.userRatingCount.toLocaleString()}개)
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-auto flex gap-[5px]">
          <button
            type="button"
            aria-label={`${item.name} 채팅으로 보내기`}
            disabled={!canSend}
            onClick={() => {
              sendPlaceMessage({
                googlePlaceId: item.googlePlaceId,
                name: item.name,
                formattedAddress: item.address ?? "",
                latitude: item.location.lat,
                longitude: item.location.lng,
                rating: item.rating ?? 0,
              });
              toast.success("장소를 채팅으로 보냈어요");
            }}
            className="pointer-events-auto flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-[7px] border border-border text-[12px] font-semibold text-primary disabled:opacity-50"
          >
            <ChatIcon size={16} />
            채팅으로 보내기
          </button>
          <button
            type="button"
            aria-label={`${item.name} 일정에 추가`}
            onClick={() => setModal("schedule")}
            className="pointer-events-auto flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-[7px] bg-primary text-[12px] font-semibold text-text-inverse"
          >
            <CalendarAddIcon size={16} className="text-icon-inverse" />
            일정에 추가
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <>
      {expanded ? (
        <MobileRouteExpandedShell onCollapse={onCollapse}>
          {summary}
          <MobileRoutePlaceDetail
            place={{
              googlePlaceId: item.googlePlaceId,
              title: item.name,
              subtitle: item.address,
              location: item.location,
              primaryTypeDisplayName: item.category,
              imageUrl: item.image,
            }}
            active={active}
            analyticsSource="search"
            analyticsRankBucket={analyticsRankBucket}
          />
        </MobileRouteExpandedShell>
      ) : (
        <div className="h-full overflow-hidden rounded-md border-[0.5px] border-border bg-fill-subtle">
          {summary}
        </div>
      )}
      {modal === "bookmark" ? (
        <AddToBookmarkModal
          googlePlaceId={item.googlePlaceId}
          placeCategory={item.category}
          source="search"
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === "schedule" ? (
        <AddToScheduleModal
          googlePlaceId={item.googlePlaceId}
          placeCategory={item.category}
          source="search"
          onClose={() => setModal(null)}
        />
      ) : null}
    </>
  );
}
