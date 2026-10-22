"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ChevronLeftIcon } from "@/assets/icons";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useRoomSchedules } from "@/hooks/useRooms";
import { readSchedulePlanPlacesFromCache } from "@/lib/plan/scheduleItemPlaces";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import {
  PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE,
  planPlaceFocusTarget,
  usePlanMapFocusStore,
} from "@/stores/plan-map-focus-store";

/** 좌우 버튼 — 누를 수 있는 영역이 숫자와 구분되도록 올리거나 누르면 둥근 배경을 깐다. 높이는 테두리 안쪽을 채운다 */
const STEP_BUTTON_CLASS =
  "flex h-full w-12 items-center justify-center rounded-full text-primary transition-colors enabled:cursor-pointer enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:text-icon-disabled focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

/**
 * 웹 동선보기 장소 이동 — 일정에서 고른 장소의 일차 안에서 이전·다음 장소로 넘긴다(Figma 6035:865).
 * 넘기면 카드를 누른 것처럼 카드·번호 핀 강조와 지도 중심을 바꾸고 상세는 열지 않는다. 일정 목록은 그 카드로 스크롤한다.
 * 순서는 카드·번호 핀과 같은 일차 장소 순서다.
 */
export function PlanRouteStepper({ roomId }: Readonly<{ roomId: string | null }>) {
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);
  const { setSelectedPlace } = useSelectedPlace();
  const focus = usePlanMapFocusStore((s) => (s.focus && s.focus.roomId === rid ? s.focus : null));
  const focusPlace = usePlanMapFocusStore((s) => s.focusPlace);
  const scheduleId = focus?.scheduleId ?? null;

  // 지도 경로(`PlanItineraryMapRoutes`)와 같은 일정 항목 캐시를 읽는다 — 따로 조회하지 않는다
  const { data: places = [] } = useQuery({
    queryKey: scheduleItemsQueryKey(rid || null, scheduleId),
    queryFn: () => (scheduleId === null ? [] : readSchedulePlanPlacesFromCache(queryClient, rid, scheduleId)),
    enabled: rid.length > 0 && scheduleId !== null && schedulesHydrated,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const index = focus ? places.findIndex((place) => place.itemId === focus.itemId) : -1;
  if (scheduleId === null || index < 0) return null;

  const current = index + 1;
  const total = places.length;
  const moveTo = (nextIndex: number) => {
    const place = places[nextIndex];
    const target = place ? planPlaceFocusTarget(place, rid, scheduleId, "stepper") : null;
    if (!target) return;
    setSelectedPlace(null);
    focusPlace(target);
    if (!target.location) toast.info(PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE);
  };

  return (
    <div
      role="group"
      aria-label="장소 이동"
      className="pointer-events-auto flex h-11 items-center gap-1 rounded-full border border-border bg-fill-elevate shadow-[0_2px_10px_rgba(0,0,0,0.1)]"
    >
      <button
        type="button"
        aria-label="이전 장소"
        disabled={index === 0}
        onClick={() => moveTo(index - 1)}
        className={STEP_BUTTON_CLASS}
      >
        <ChevronLeftIcon size={20} />
      </button>
      <p aria-live="polite" className="whitespace-nowrap text-text">
        <span aria-hidden className="flex items-center gap-1">
          <span className="text-label-l-emphasis">{current}</span>
          <span className="text-label-m-regular">/</span>
          <span className="text-label-l-emphasis">{total}</span>
        </span>
        <span className="sr-only">
          전체 {total}곳 중 {current}번째 장소
        </span>
      </p>
      <button
        type="button"
        aria-label="다음 장소"
        disabled={index === total - 1}
        onClick={() => moveTo(index + 1)}
        className={STEP_BUTTON_CLASS}
      >
        <ChevronLeftIcon size={20} className="rotate-180" />
      </button>
    </div>
  );
}
