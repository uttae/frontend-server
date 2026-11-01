"use client";

import { useRef, useState } from "react";
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
  ROOM_TRIP_TITLE_MAX_LENGTH,
  toTripFormValues,
  type RoomTripFormSource,
} from "@/lib/rooms/trip-form";

type Props = {
  room: RoomTripFormSource;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function RoomTripEditForm(props: Props) {
  return <RoomTripEditSession key={props.room.id} {...props} />;
}

function RoomTripEditSession({ room, readOnly = false, onSaved }: Props) {
  /** 서버 최신 값 — 다른 멤버가 바꾸면 따라 바뀐다. 읽기 전용 표시와 저장 직전 기준(기간 축소 확인·이전 기간)에 쓴다 */
  // 저장은 화면에 보이는 폼 값 그대로 보낸다 — 열어 둔 사이 다른 멤버가 바꾼 값보다 마지막에 저장한 사람의 화면 값이 남는다
  const latest = toTripFormValues(room);
  /**
   * 모달을 연 순간의 값 — 열려 있는 동안 서버 값이 바뀌어도 입력 칸을 다시 채우지 않는다.
   * 바뀐 값은 사이드 패널·헤더에 먼저 보이고, 모달을 다시 열면 그때의 최신 값으로 시작한다.
   */
  const [opened, setOpened] = useState(latest);

  const [title, setTitle] = useState(opened.title);
  const [destinations, setDestinations] = useState<string[]>(opened.destinations);
  const [startDate, setStartDate] = useState(opened.startDate);
  const [endDate, setEndDate] = useState(opened.endDate);
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false);

  const { data: schedules } = useRoomSchedules(room.id);
  const { mutate: updateRoom, isPending, error } = useUpdateRoom();

  const dateRangeInvalid = isTripDateRangeInvalid(startDate, endDate);
  const scheduleDayLimitExceeded = isTripScheduleDayLimitExceeded(
    startDate,
    endDate,
  );
  const scheduleCount = schedules?.length ?? 0;

  /** 연 순간과 비교한다 — 서버 값이 바뀌어도 사용자가 바꾼 게 없으면 적용하기를 켜지 않는다 */
  const isDirty =
    title !== opened.title ||
    !areDestinationsEqual(destinations, opened.destinations) ||
    startDate !== opened.startDate ||
    endDate !== opened.endDate;

  const canApply =
    title.trim() &&
    isTripDestinationsValid(destinations) &&
    startDate &&
    endDate &&
    !dateRangeInvalid &&
    !scheduleDayLimitExceeded &&
    !isPending &&
    isDirty;

  const submitInFlight = useRef(false);
  function submitUpdate() {
    if (submitInFlight.current || readOnly) return;
    submitInFlight.current = true;
    updateRoom(
      {
        roomId: room.id,
        data: {
          title: title.trim().slice(0, ROOM_TRIP_TITLE_MAX_LENGTH),
          destinations: destinations.map((d) => d.trim()),
          startDate,
          endDate,
        },
        previousStartDate: latest.startDate,
        previousEndDate: latest.endDate,
      },
      {
        onSettled: () => { submitInFlight.current = false; },
        onSuccess: () => {
          setShrinkConfirmOpen(false);
          // 저장한 값이 새 기준 — 모달이 남아 있어도 다시 바꾼 게 없으면 적용하기가 꺼진다
          setOpened({ title, destinations, startDate, endDate });
          toast.success("여행 정보가 수정되었어요");
          onSaved?.();
        },
      },
    );
  }

  function handleApply() {
    if (!canApply) return;

    // 서버는 지금 기간에서 잘라내므로, 열 때가 아니라 서버 최신 기간과 저장할 폼 기간을 비교한다
    const trimCount = countSchedulesTrimmedByDateChange(
      scheduleCount,
      latest.startDate,
      latest.endDate,
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
        values={readOnly ? latest : { title, destinations, startDate, endDate }}
        readOnly={readOnly}
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
        <SettingsActionButtonRow className="pt-0">
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
