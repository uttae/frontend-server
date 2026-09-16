"use client";
import { MapPin } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { PlanPlace } from "@/lib/plan/types";

export function ExpensePlaceLabel({ roomId, scheduleId, itemId }: {
  roomId: string;
  scheduleId: number;
  itemId: number;
}) {
  const client = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => client.getQueryCache().subscribe(onChange),
    [client],
  );
  const readName = useCallback(() => {
    const places = client.getQueryData<PlanPlace[]>(scheduleItemsQueryKey(roomId.trim(), scheduleId));
    const title = places?.find(place => place.itemId === itemId)?.title?.trim();
    // The schedule cache can contain this preview-failure placeholder instead of a name.
    return title && title !== "장소 정보를 불러올 수 없음" ? title : "확인되지 않음";
  }, [client, roomId, scheduleId, itemId]);
  // Subscribe to existing cache only; no query observer or fetch is started here.
  const label = useSyncExternalStore(subscribe, readName, () => "확인되지 않음");
  return (
    <span title={label} className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-normal text-dark-gray">
      <MapPin size={14} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
