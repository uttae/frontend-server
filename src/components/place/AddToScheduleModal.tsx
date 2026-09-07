"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useCreateScheduleItem, useRoomSchedules } from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import {
  AnalyticsEvents,
  trackAnalyticsEvent,
  type ItinerarySource,
} from "@/lib/analytics/track";
import { sortRoomSchedules } from "@/lib/plan/scheduleMerge";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { PlanPlace } from "@/lib/plan/types";
import {
  formatKoreanDateLabel,
  parseLocalYmd,
} from "@/lib/plan/tripRange";
import { useSessionStore } from "@/stores/session-store";

type Props = {
  googlePlaceId: string;
  placeCategory?: string;
  source?: ItinerarySource;
  onClose: () => void;
  onAdded?: () => void;
};

export function AddToScheduleModal({
  googlePlaceId,
  placeCategory,
  source = "search",
  onClose,
  onAdded,
}: Props) {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const rid = typeof roomId === "string" ? roomId.trim() : "";

  const {
    data: schedules,
    isPending: schedulesLoading,
    isError: schedulesError,
    error: schedulesErr,
    refetch,
  } = useRoomSchedules(rid.length > 0 ? rid : null);

  const queryClient = useQueryClient();
  const { mutateAsync: createItem, isPending: isAdding } =
    useCreateScheduleItem();

  const sorted = schedules ? sortRoomSchedules(schedules) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pickDay(scheduleId: number) {
    if (!rid || isAdding) return;
    try {
      const cached =
        queryClient.getQueryData<PlanPlace[]>(
          scheduleItemsQueryKey(rid, scheduleId),
        ) ?? [];
      await createItem({
        roomId: rid,
        scheduleId,
        googlePlaceId,
        insertIndex: cached.length,
        placesSnapshot: cached,
      });
      trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
        item_count_bucket: bucketItemCount(cached.length + 1),
        place_category: placeCategory,
        interaction_source: source,
      });
      toast.success("일정에 추가했어요.");
      onAdded?.();
      onClose();
    } catch {
      toast.error("일정에 추가하지 못했어요.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(80vh,520px)] w-full max-w-sm flex-col rounded-2xl border border-gray-border bg-white shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-schedule-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-gray-border px-5 py-4">
          <h2
            id="add-schedule-modal-title"
            className="text-[22px] font-semibold text-neutral-900"
          >
            일정에 추가
          </h2>
          <p className="mt-1 text-[17px] text-dark-gray">
            담을 여행 일차를 선택하세요.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!rid ? (
            <p className="text-center text-[17px] text-dark-gray">
              참여 중인 방이 없어요. 방에 입장한 뒤 다시 시도해 주세요.
            </p>
          ) : null}

          {rid && schedulesLoading ? (
            <p className="text-center text-[17px] text-dark-gray">불러오는 중…</p>
          ) : null}

          {rid && schedulesError ? (
            <div className="space-y-2 text-center">
              <p className="text-[17px] text-primary">
                {schedulesErr instanceof Error
                  ? schedulesErr.message
                  : "일정을 불러오지 못했습니다."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[17px] font-medium text-neutral-900 underline"
              >
                다시 시도
              </button>
            </div>
          ) : null}

          {rid && !schedulesLoading && !schedulesError && sorted.length === 0 ? (
            <p className="text-center text-[17px] text-dark-gray">
              아직 생성된 일정이 없어요. 계획 탭에서 여행 기간을 적용한 뒤
              다시 시도해 주세요.
            </p>
          ) : null}

          {rid && sorted.length > 0 ? (
            <ul className="space-y-2">
              {sorted.map((s, i) => (
                <li key={s.scheduleId}>
                  <button
                    type="button"
                    disabled={isAdding}
                    onClick={() => void pickDay(s.scheduleId)}
                    className="flex w-full flex-col gap-0.5 rounded-xl border border-gray-border px-3 py-3 text-left transition-colors hover:bg-bubble-gray disabled:opacity-60"
                  >
                    <span className="text-[17px] font-medium text-neutral-900">
                      {`${i + 1}일차`}
                    </span>
                    <span className="text-[14px] text-dark-gray">
                      {formatKoreanDateLabel(parseLocalYmd(s.date))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-neutral-800 transition-colors hover:bg-bubble-gray"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
