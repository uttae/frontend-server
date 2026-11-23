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

export function useMobileAddPlaceSearch({
  roomId,
  backLabel,
  onAdded,
}: {
  roomId: string;
  backLabel: string;
  onAdded?: (itemId: number) => void;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: createItem } = useCreateScheduleItem();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const addTargetRef = useRef<{ scheduleId: number; anchor: InsertAnchor | null } | null>(null);
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimerRef.current), []);

  function showAddedPlace(itemId: number) {
    window.clearTimeout(highlightTimerRef.current);
    setRecentlyAddedItemId(itemId);
    highlightTimerRef.current = window.setTimeout(() => setRecentlyAddedItemId(null), ADDED_HIGHLIGHT_MS);
  }

  function open(scheduleId: number, anchor: InsertAnchor | null) {
    addTargetRef.current = { scheduleId, anchor };
    flushSync(() => setSearchOpen(true));
    searchInputRef.current?.focus();
  }

  function close() {
    setSearchOpen(false);
    setSearchResetKey((k) => k + 1);
  }

  async function addAt(
    target: { scheduleId: number; anchor: InsertAnchor | null },
    googlePlaceId: string,
    interactionSource: AnalyticsSource,
  ): Promise<number | null> {
    const latest =
      queryClient.getQueryData<PlanPlace[]>(scheduleItemsQueryKey(roomId.trim() || null, target.scheduleId)) ?? [];
    const insertIndex = resolveInsertIndex(latest, target.anchor);
    try {
      const { createdItem: created } = await createItem({
        roomId,
        scheduleId: target.scheduleId,
        googlePlaceId,
        insertIndex,
        placesSnapshot: latest,
      });
      trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
        room_id: roomId,
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
