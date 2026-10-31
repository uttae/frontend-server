"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { SyntheticEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

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

// 포털 안 클릭·터치가 React 트리를 따라 부모(지도 상세 패널·시트 드래그, 검색 결과 카드)로 올라가지 않게 Root 바깥에서 끊는다.
// 딤은 표면 밖이라 표면 props로는 못 막는다. 감싼 요소는 display: contents라 배치에 상자를 더하지 않는다
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

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
        room_id: rid,
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
      className="contents"
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <Dialog
        open
        closeDisabled={isAdding}
        // 열린 채 마운트되므로 닫기 요청(open=false)만 온다. 추가 중에는 Esc·딤·닫기를 막는다
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent size="sm" showCloseButton={false} className="max-h-[min(80dvh,520px)]">
          <DialogHeader>
            <DialogTitle>일정에 추가</DialogTitle>
            <DialogDescription>담을 여행 일차를 선택하세요.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {!rid ? (
              <p className="text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
                참여 중인 방이 없어요. 방에 입장한 뒤 다시 시도해 주세요.
              </p>
            ) : null}

            {rid && schedulesLoading ? (
              <div className="flex justify-center py-6">
                <Spinner aria-label="일정 불러오는 중" />
              </div>
            ) : null}

            {rid && schedulesError ? (
              <div className="space-y-2 text-center">
                <p className="text-body-m-regular mobile:text-body-s-regular text-primary">
                  {schedulesErr instanceof Error
                    ? schedulesErr.message
                    : "일정을 불러오지 못했습니다."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 underline"
                >
                  다시 시도
                </button>
              </div>
            ) : null}

            {rid && !schedulesLoading && !schedulesError && sorted.length === 0 ? (
              <p className="text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
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
                      <span className="text-body-m-emphasis mobile:text-body-s-emphasis font-medium text-neutral-900">
                        {`${i + 1}일차`}
                      </span>
                      <span className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
                        {formatKoreanDateLabel(parseLocalYmd(s.date))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose render={<Button variant="weak" />}>닫기</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
