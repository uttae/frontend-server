"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TripDateShrinkConfirmModal } from "@/components/rooms/TripDateShrinkConfirmModal";
import { RoomTripEditFields } from "@/components/rooms/RoomTripEditFields";
import { Button } from "@/components/ui/button";
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
  type TripFormValues,
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
   * 모달을 연 순간의 값 — 폼의 defaultValues다. 열려 있는 동안 서버 값이 바뀌어도 입력 칸을 다시 채우지 않는다.
   * 바뀐 값은 사이드 패널·헤더에 먼저 보이고, 모달을 다시 열면 그때의 최신 값으로 시작한다.
   */
  const [opened, setOpened] = useState(latest);
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false);

  const { data: schedules } = useRoomSchedules(room.id);
  const { mutate: updateRoom, isPending, error } = useUpdateRoom();
  const scheduleCount = schedules?.length ?? 0;

  const submitInFlight = useRef(false);
  function submitUpdate(value: TripFormValues) {
    if (submitInFlight.current || readOnly) return;
    submitInFlight.current = true;
    updateRoom(
      {
        roomId: room.id,
        data: {
          title: value.title.trim().slice(0, ROOM_TRIP_TITLE_MAX_LENGTH),
          destinations: value.destinations.map((d) => d.trim()),
          startDate: value.startDate,
          endDate: value.endDate,
        },
        previousStartDate: latest.startDate,
        previousEndDate: latest.endDate,
      },
      {
        onSettled: () => { submitInFlight.current = false; },
        onSuccess: () => {
          setShrinkConfirmOpen(false);
          // 저장한 값이 새 기준 — 모달이 남아 있어도 다시 바꾼 게 없으면 적용하기가 꺼진다
          setOpened(value);
          form.reset(value);
          toast.success("여행 정보가 수정되었어요");
          onSaved?.();
        },
      },
    );
  }

  const form = useForm({
    defaultValues: opened,
    onSubmit: ({ value }) => {
      // 서버는 지금 기간에서 잘라내므로, 열 때가 아니라 서버 최신 기간과 저장할 폼 기간을 비교한다
      const trimCount = countSchedulesTrimmedByDateChange(
        scheduleCount,
        latest.startDate,
        latest.endDate,
        value.startDate,
        value.endDate,
      );
      if (trimCount > 0) {
        setShrinkConfirmOpen(true);
        return;
      }
      submitUpdate(value);
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const { title, destinations, startDate, endDate } = values;

  /**
   * 연 순간과 비교한다 — 서버 값이 바뀌어도 사용자가 바꾼 게 없으면 적용하기를 켜지 않는다.
   * TanStack isDirty는 한 번 바뀌면 남아서, 되돌리면 다시 꺼지는 지금 기준을 그대로 쓴다
   */
  const isDirty =
    title !== opened.title ||
    !areDestinationsEqual(destinations, opened.destinations) ||
    startDate !== opened.startDate ||
    endDate !== opened.endDate;

  // 칸 오류 문장은 RoomTripEditFields가 입력 중에 바로 보여 주고, 여기서는 적용하기만 잠근다(지금 화면 동작).
  // 잠긴 버튼은 제출되지 않아 칸별 onSubmit 검증을 따로 두지 않는다
  const canApply =
    title.trim() &&
    isTripDestinationsValid(destinations) &&
    startDate &&
    endDate &&
    !isTripDateRangeInvalid(startDate, endDate) &&
    !isTripScheduleDayLimitExceeded(startDate, endDate) &&
    !isPending &&
    isDirty;

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      <RoomTripEditFields
        idPrefix={`trip-${room.id}`}
        values={readOnly ? latest : values}
        readOnly={readOnly}
        onTitleChange={(next) => form.setFieldValue("title", next)}
        onDestinationsChange={(next) => form.setFieldValue("destinations", next)}
        onStartDateChange={(next) => form.setFieldValue("startDate", next)}
        onEndDateChange={(next) => form.setFieldValue("endDate", next)}
      />

      {error && !readOnly && (
        <p className="text-center text-body-m-regular mobile:text-body-s-regular text-primary">
          {error instanceof Error
            ? error.message
            : "수정에 실패했어요. 다시 시도해주세요."}
        </p>
      )}

      {/* form 요소로 감싸지 않는다 — 지금처럼 제목 칸 Enter로 저장되지 않게 둔다 */}
      {!readOnly && (
        <Button
          className="w-full"
          disabled={!canApply}
          loading={isPending}
          loadingLabel="저장 중"
          onClick={() => {
            if (!canApply || form.state.isSubmitting) return;
            void form.handleSubmit();
          }}
        >
          적용하기
        </Button>
      )}

      {/* 여행 정보 수정 대화상자의 React 자식으로 둬야 Base UI가 위 레이어(확인창)만 Esc·포커스를 처리한다 */}
      {shrinkConfirmOpen ? (
        <TripDateShrinkConfirmModal
          isPending={isPending}
          onClose={() => setShrinkConfirmOpen(false)}
          onConfirm={() => submitUpdate(form.state.values)}
        />
      ) : null}
    </div>
  );
}
