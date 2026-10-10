"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MobilePlaceSearchScreen } from "@/components/search/MobilePlaceSearchScreen";
import { useCreateScheduleItem } from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent, type AnalyticsSource } from "@/lib/analytics/track";
import type { MapSearchPlaceEntry } from "@/lib/map-search-history";
import { resolveInsertIndex, type InsertAnchor } from "@/lib/plan/insertPosition";
import type { PlanPlace } from "@/lib/plan/types";
import { scheduleItemsQueryKey } from "@/lib/query-keys";

const ADDED_HIGHLIGHT_MS = 1500;

/**
 * 전체 화면 검색으로 일차의 원하는 자리(anchor)에 장소를 추가한다 — 일정 화면과 지도 경로 보기가 함께 쓴다.
 * 검색 화면(`screen`)은 포털로 뜨므로 어디에 렌더해도 된다. 검색 없이 고른 장소(지도)는 `addAt`으로 같은 자리에 넣는다.
 */
export function useMobileAddPlaceSearch({
  roomId,
  backLabel,
  onAdded,
}: {
  roomId: string;
  /** 검색 화면의 뒤로가기 안내 — 예: "일정으로 돌아가기" */
  backLabel: string;
  /** 추가가 끝난 뒤 — 예: 경로 보기에서 새 카드를 고른다 */
  onAdded?: (itemId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: createItem } = useCreateScheduleItem();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResetKey, setSearchResetKey] = useState(0);
  /** anchor: 장소 사이에 넣을 기준, null이면 맨 뒤 */
  const addTargetRef = useRef<{ scheduleId: number; anchor: InsertAnchor | null } | null>(null);
  // 방금 추가한 장소 — 해당 카드로 스크롤하고 잠깐 강조한다
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

  function showAddedPlace(itemId: number) {
    window.clearTimeout(highlightTimerRef.current);
    setRecentlyAddedItemId(itemId);
    highlightTimerRef.current = window.setTimeout(() => setRecentlyAddedItemId(null), ADDED_HIGHLIGHT_MS);
  }

  /** 탭 제스처 안에서 호출해야 한다 — 검색창에 바로 포커스해 키보드를 띄운다 */
  function open(scheduleId: number, anchor: InsertAnchor | null) {
    addTargetRef.current = { scheduleId, anchor };
    // 검색 화면을 먼저 그린 뒤 같은 탭 안에서 focus해야 iOS에서도 키보드가 뜬다
    flushSync(() => setSearchOpen(true));
    searchInputRef.current?.focus();
  }

  function close() {
    setSearchOpen(false);
    setSearchResetKey((k) => k + 1);
  }

  /** anchor 자리에 장소를 넣는다 — 성공하면 새 일정 항목 ID */
  async function addAt(
    target: { scheduleId: number; anchor: InsertAnchor | null },
    googlePlaceId: string,
    interactionSource: AnalyticsSource,
  ): Promise<number | null> {
    // 고르는 동안 다른 사람이 일정을 바꿨을 수 있어 고른 시점의 최신 목록으로 위치를 정한다
    const latest =
      queryClient.getQueryData<PlanPlace[]>(scheduleItemsQueryKey(roomId.trim() || null, target.scheduleId)) ?? [];
    const insertIndex = resolveInsertIndex(latest, target.anchor);
    try {
      const created = await createItem({
        roomId,
        scheduleId: target.scheduleId,
        googlePlaceId,
        insertIndex,
        placesSnapshot: latest,
      });
      trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
        item_count_bucket: bucketItemCount(latest.length + 1),
        interaction_source: interactionSource,
      });
      toast.success("일정에 추가했어요.");
      showAddedPlace(created.itemId);
      onAdded?.(created.itemId);
      return created.itemId;
    } catch {
      toast.error("장소를 일정에 추가하지 못했어요.");
      return null;
    }
  }

  async function handleSelectPlace(entry: MapSearchPlaceEntry): Promise<MapSearchPlaceEntry | null> {
    const target = addTargetRef.current;
    if (!target) return null;
    const itemId = await addAt(target, entry.googlePlaceId, "search");
    if (itemId === null) return null;
    close();
    return entry;
  }

  const screen = (
    <MobilePlaceSearchScreen
      open={searchOpen}
      onClose={close}
      inputRef={searchInputRef}
      backLabel={backLabel}
      onSelectPlace={handleSelectPlace}
      resetKey={searchResetKey}
    />
  );

  return { open, addAt, screen, recentlyAddedItemId, showAddedPlace };
}
