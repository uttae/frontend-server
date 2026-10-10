"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import { TripDateShrinkConfirmModal } from "@/components/rooms/TripDateShrinkConfirmModal";
import { RoomTripEditFields } from "@/components/rooms/RoomTripEditFields";
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
  onCancel?: () => void;
  onSaved?: () => void;
};

export function RoomTripEditForm(props: Props) {
  return <RoomTripEditSession key={props.room.id} {...props} />;
}

function RoomTripEditSession({ room, readOnly = false, onCancel, onSaved }: Props) {
  const saved = toTripFormValues(room);

  const [title, setTitle] = useState(saved.title);
  const [destinations, setDestinations] = useState<string[]>(saved.destinations);
  const [startDate, setStartDate] = useState(saved.startDate);
  const [endDate, setEndDate] = useState(saved.endDate);
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false);

  // Keep the original date floor throughout this room's edit session.
  const [baselineStartYmd] = useState(saved.startDate);
  const endDateMin = tripEndDateMinYmd(startDate, baselineStartYmd);

  const { data: schedules } = useRoomSchedules(room.id);
  const { mutate: updateRoom, isPending, error } = useUpdateRoom();
  const savedSignature = JSON.stringify(saved);
  const [previousSavedSignature, setPreviousSavedSignature] = useState(savedSignature);
  if (previousSavedSignature !== savedSignature) {
    setPreviousSavedSignature(savedSignature);
    setTitle(saved.title);
    setDestinations(saved.destinations);
    setStartDate(saved.startDate);
    setEndDate(saved.endDate);
  }

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
          onSaved?.();
        },
      },
    );
  }, [
    setShrinkConfirmOpen,
    destinations,
    endDate,
    room.id,
    saved.endDate,
    saved.startDate,
    startDate,
    title,
    updateRoom,
    onSaved,
  ]);

  function handleCancel() {
    const next = toTripFormValues(room);
    setTitle(next.title);
    setDestinations(next.destinations);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setShrinkConfirmOpen(false);
    onCancel?.();
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
      <RoomTripEditFields
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
        <p className="text-center text-body-m-regular mobile:text-body-s-regular text-primary">
          {error instanceof Error
            ? error.message
            : "수정에 실패했어요. 다시 시도해주세요."}
        </p>
      )}

      {!readOnly && (
        <SettingsActionButtonRow className="gap-3 pt-0">
          <SettingsActionButton
            variant="secondary"
            className="h-12 rounded-lg border-border bg-fill-subtle py-0 text-[16px] font-bold text-text hover:bg-fill"
            onClick={handleCancel}
            disabled={(!onCancel && !isDirty) || isPending}
          >
            취소
          </SettingsActionButton>
          <SettingsActionButton
            variant="primary"
            className="h-12 rounded-lg py-0 text-[16px] font-bold enabled:hover:bg-primary-strong hover:opacity-100 disabled:bg-fill disabled:text-text-disabled disabled:opacity-100"
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
