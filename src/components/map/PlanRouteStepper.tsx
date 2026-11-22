"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ChevronLeftIcon } from "@/assets/icons";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useRoomSchedules } from "@/hooks/useRooms";
import { schedulePlanPlacesQueryOptions } from "@/lib/plan/scheduleItemPlaces";
import {
  PLAN_MAP_FOCUS_NO_LOCATION_MESSAGE,
  planPlaceFocusTarget,
  usePlanMapFocusStore,
} from "@/stores/plan-map-focus-store";

const STEP_BUTTON_CLASS =
  "flex h-full w-12 items-center justify-center rounded-full text-primary transition-colors enabled:cursor-pointer enabled:hover:bg-fill enabled:active:bg-fill-strong disabled:text-icon-disabled focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary";

export function PlanRouteStepper({ roomId }: Readonly<{ roomId: string | null }>) {
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const queryClient = useQueryClient();
  const { isSuccess: schedulesHydrated } = useRoomSchedules(rid || null);
  const { setSelectedPlace } = useSelectedPlace();
  const focus = usePlanMapFocusStore((s) => (s.focus && s.focus.roomId === rid ? s.focus : null));
  const focusPlace = usePlanMapFocusStore((s) => s.focusPlace);
  const scheduleId = focus?.scheduleId ?? null;

  const { data: places = [] } = useQuery({
    ...schedulePlanPlacesQueryOptions(queryClient, rid, scheduleId),
    enabled: rid.length > 0 && scheduleId !== null && schedulesHydrated,
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
