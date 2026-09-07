"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import { TripDateShrinkConfirmModal } from "@/components/rooms/TripDateShrinkConfirmModal";
import { TripFormFields } from "@/components/rooms/TripFormFields";
import { useRoomSchedules, useUpdateRoom } from "@/hooks/useRooms";
import {
  countSchedulesTrimmedByDateChange,
  isTripScheduleDayLimitExceeded,
} from "@/lib/plan/schedulePolicy";
import {
  areDestinationsEqual,
  isTripDateRangeInvalid,
  isTripDestinationsValid,
  isTripStartBeforeMin,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  toTripFormValues,
  tripEndDateMinYmd,
  type RoomTripFormSource,
} from "@/lib/rooms/trip-form";

type Props = {
  room: RoomTripFormSource;
  readOnly?: boolean;
};

export function RoomTripEditForm({ room, readOnly = false }: Props) {
  const saved = toTripFormValues(room);

  const [title, setTitle] = useState(saved.title);
  const [destinations, setDestinations] = useState<string[]>(saved.destinations);
  const [startDate, setStartDate] = useState(saved.startDate);
  const [endDate, setEndDate] = useState(saved.endDate);
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false);

  const baselineStartRef = useRef(saved.startDate);
  useEffect(() => {
    baselineStartRef.current = toTripFormValues(room).startDate;
  }, [room.id]);

  const baselineStartYmd = baselineStartRef.current;
  const endDateMin = tripEndDateMinYmd(startDate, baselineStartYmd);

  const { data: schedules } = useRoomSchedules(room.id);
  const { mutate: updateRoom, isPending, error } = useUpdateRoom();

  const destinationsSignature = room.destinations.join(" ");

  useEffect(() => {
    const next = toTripFormValues(room);
    setTitle(next.title);
    setDestinations(next.destinations);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
  }, [
    room.id,
    room.title,
    destinationsSignature,
    room.startDate,
    room.endDate,
  ]);

  const dateRangeInvalid = isTripDateRangeInvalid(startDate, endDate);
  const scheduleDayLimitExceeded = isTripScheduleDayLimitExceeded(
    startDate,
    endDate,
  );
  const scheduleCount = schedules?.length ?? 0;

  const isDirty =
    title !== saved.title ||
    !areDestinationsEqual(destinations, saved.destinations) ||
    startDate !== saved.startDate ||
    endDate !== saved.endDate;

  const canApply =
    title.trim() &&
    isTripDestinationsValid(destinations) &&
    startDate &&
    endDate &&
    !dateRangeInvalid &&
    !isTripStartBeforeMin(startDate, baselineStartYmd) &&
    !scheduleDayLimitExceeded &&
    !isPending &&
    isDirty;

  const submitUpdate = useCallback(() => {
    updateRoom(
      {
        roomId: room.id,
        data: {
          title: title.trim().slice(0, ROOM_TRIP_TITLE_MAX_LENGTH),
          destinations: destinations.map((d) => d.trim()),
          startDate,
          endDate,
        },
        previousStartDate: saved.startDate,
        previousEndDate: saved.endDate,
      },
      {
        onSuccess: () => {
          setShrinkConfirmOpen(false);
          toast.success("여행 정보가 수정되었어요");
        },
      },
    );
  }, [
    destinations,
    endDate,
    room.id,
    saved.endDate,
    saved.startDate,
    startDate,
    title,
    updateRoom,
  ]);

  function handleCancel() {
    const next = toTripFormValues(room);
    setTitle(next.title);
    setDestinations(next.destinations);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setShrinkConfirmOpen(false);
  }

  function handleApply() {
    if (!canApply) return;

    const trimCount = countSchedulesTrimmedByDateChange(
      scheduleCount,
      saved.startDate,
      saved.endDate,
      startDate,
      endDate,
    );

    if (trimCount > 0) {
      setShrinkConfirmOpen(true);
      return;
    }

    submitUpdate();
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      <TripFormFields
        idPrefix={`trip-${room.id}`}
        values={{ title, destinations, startDate, endDate }}
        readOnly={readOnly}
        startDateMin={baselineStartYmd || undefined}
        endDateMin={endDateMin || undefined}
        onTitleChange={setTitle}
        onDestinationsChange={setDestinations}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {error && !readOnly && (
        <p className="text-center text-[17px] text-primary">
          {error instanceof Error
            ? error.message
            : "수정에 실패했어요. 다시 시도해주세요."}
        </p>
      )}

      {!readOnly && (
        <SettingsActionButtonRow>
          <SettingsActionButton
            variant="secondary"
            onClick={handleCancel}
            disabled={!isDirty || isPending}
          >
            취소
          </SettingsActionButton>
          <SettingsActionButton
            variant="primary"
            onClick={handleApply}
            disabled={!canApply}
          >
            {isPending ? "저장 중…" : "적용하기"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      )}

      {shrinkConfirmOpen ? (
        <TripDateShrinkConfirmModal
          isPending={isPending}
          onClose={() => setShrinkConfirmOpen(false)}
          onConfirm={submitUpdate}
        />
      ) : null}
    </div>
  );
}
