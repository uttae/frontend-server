"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { DateRangeField } from "@/components/date-picker/DateRangeField";
import { DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import { RoomTripReadOnlyFields } from "@/components/rooms/RoomTripReadOnlyFields";
import { TripDateShrinkConfirmModal } from "@/components/rooms/TripDateShrinkConfirmModal";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRoomSchedules, type useUpdateRoom } from "@/hooks/useRooms";
import { countSchedulesTrimmedByDateChange } from "@/lib/plan/schedulePolicy";
import {
  areDestinationsEqual,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  toTripFormValues,
  TRIP_DESTINATION_MAX_LENGTH,
  TRIP_DESTINATIONS_MAX_COUNT,
  tripDateRangeError,
  tripDestinationsError,
  tripTitleError,
  type RoomTripFormSource,
  type TripFormValues,
} from "@/lib/rooms/trip-form";

type Props = {
  room: RoomTripFormSource;
  /** 여행 정보 저장 요청. 대화상자가 저장 중에 닫히지 않게 그 isPending을 쓰므로 대화상자가 만들어 내려 준다 */
  update: ReturnType<typeof useUpdateRoom>;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function RoomTripEditForm(props: Props) {
  return <RoomTripEditSession key={props.room.id} {...props} />;
}

function RoomTripEditSession({ room, update, readOnly = false, onSaved }: Readonly<Props>) {
  /** 서버 최신 값 — 다른 멤버가 바꾸면 따라 바뀐다. 읽기 전용 표시와 저장 직전 기준(기간 축소 확인·이전 기간)에 쓴다 */
  // 저장은 화면에 보이는 폼 값 그대로 보낸다 — 열어 둔 사이 다른 멤버가 바꾼 값보다 마지막에 저장한 사람의 화면 값이 남는다
  const latest = toTripFormValues(room);
  /**
   * 모달을 연 순간의 값 — 폼의 defaultValues다. 열려 있는 동안 서버 값이 바뀌어도 입력 칸을 다시 채우지 않는다.
   * 바뀐 값은 사이드 패널·헤더에 먼저 보이고, 모달을 다시 열면 그때의 최신 값으로 시작한다.
   */
  const [opened, setOpened] = useState(latest);
  const [shrinkConfirmOpen, setShrinkConfirmOpen] = useState(false);
  const idPrefix = `trip-${room.id}`;

  const { data: schedules } = useRoomSchedules(room.id);
  const { mutate: updateRoom, isPending, error } = update;
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

  // 칸 오류는 각 form.Field의 validators가 입력할 때마다 칸 아래에 보인다. 적용하기는 같은 검증 함수로 잠근다
  // (validators는 건드린 칸에서만 돌아서, 연 순간부터 비어 있던 칸(기간 없는 방 등)도 잠그려면 값으로 다시 본다)
  const canApply =
    !tripTitleError(title) &&
    !tripDestinationsError(destinations) &&
    !tripDateRangeError(startDate, endDate) &&
    !isPending &&
    isDirty;

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      {readOnly ? (
        <RoomTripReadOnlyFields idPrefix={idPrefix} values={latest} />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <form.Field name="title" validators={{ onChange: ({ value }) => tripTitleError(value) }}>
            {(field) => {
              const fieldError = field.state.meta.errors[0];
              return (
                <Field>
                  <FieldLabel htmlFor={`${idPrefix}-title`}>여행 제목</FieldLabel>
                  <Input
                    id={`${idPrefix}-title`}
                    type="text"
                    value={field.state.value}
                    maxLength={ROOM_TRIP_TITLE_MAX_LENGTH}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? `${idPrefix}-title-error` : undefined}
                    onChange={(event) => field.handleChange(event.target.value.slice(0, ROOM_TRIP_TITLE_MAX_LENGTH))}
                    onBlur={field.handleBlur}
                    placeholder="예: 봄 일본 여행, 하와이 신혼여행"
                  />
                  <FieldError id={`${idPrefix}-title-error`}>{fieldError}</FieldError>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="destinations" validators={{ onChange: ({ value }) => tripDestinationsError(value) }}>
            {(field) => (
              <Field>
                {/* 검색 입력이 DestinationSearchInput 안에 있어 label로 잇지 못한다. 입력 이름은 aria-label '목적지 검색'이다 */}
                <p className="text-label-xs-regular text-text">목적지</p>
                <DestinationChipsField
                  values={field.state.value}
                  onChange={field.handleChange}
                  maxCount={TRIP_DESTINATIONS_MAX_COUNT}
                  maxLength={TRIP_DESTINATION_MAX_LENGTH}
                />
                <FieldError>{field.state.meta.errors[0]}</FieldError>
              </Field>
            )}
          </form.Field>

          {/* 기간은 칸 하나(DateRangeField)가 두 값을 바꾼다. 오류는 끝 날짜 칸이 시작 날짜와 함께 검증해 기간 아래에 보인다 */}
          <form.Field
            name="endDate"
            validators={{ onChange: ({ value, fieldApi }) => tripDateRangeError(fieldApi.form.getFieldValue("startDate"), value) }}
          >
            {(field) => (
              <div className="flex min-w-0 flex-col gap-2">
                {/* 스크롤되는 모달이고 칸 폭(약 176px)에 맞추면 달력이 절반 크기가 되어 팝업으로 띄운다 */}
                <DateRangeField
                  idPrefix={idPrefix}
                  value={{ start: startDate, end: field.state.value }}
                  popupOnly
                  onChange={(next) => {
                    form.setFieldValue("startDate", next.start);
                    field.handleChange(next.end);
                  }}
                />
                <FieldError>{field.state.meta.errors[0]}</FieldError>
              </div>
            )}
          </form.Field>
        </div>
      )}

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
