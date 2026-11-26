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
  createTripDatesSchema,
  createTripFormSchema,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  toTripFormValues,
  TRIP_DESTINATION_MAX_LENGTH,
  TRIP_DESTINATIONS_MAX_COUNT,
  tripDestinationsSchema,
  tripTitleSchema,
  type RoomTripFormSource,
  type TripFormValues,
} from "@/lib/rooms/trip-form";

const tripFormSchema = createTripFormSchema();
const tripDatesSchema = createTripDatesSchema();

type Props = {
  room: RoomTripFormSource;
  update: ReturnType<typeof useUpdateRoom>;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function RoomTripEditForm(props: Props) {
  return <RoomTripEditSession key={props.room.id} {...props} />;
}

function RoomTripEditSession({ room, update, readOnly = false, onSaved }: Readonly<Props>) {
  const latest = toTripFormValues(room);
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
        data: tripFormSchema.parse(value),
        previousStartDate: latest.startDate,
        previousEndDate: latest.endDate,
      },
      {
        onSettled: () => {
          submitInFlight.current = false;
        },
        onSuccess: () => {
          setShrinkConfirmOpen(false);
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
    canSubmitWhenInvalid: true,
    onSubmit: ({ value }) => {
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

  const isDirty =
    title !== opened.title ||
    !areDestinationsEqual(destinations, opened.destinations) ||
    startDate !== opened.startDate ||
    endDate !== opened.endDate;

  const canApply = !isPending && isDirty;

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      {readOnly ? (
        <RoomTripReadOnlyFields idPrefix={idPrefix} values={latest} />
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <form.Field name="title" validators={{ onChange: tripTitleSchema }}>
            {(field) => {
              const fieldError = field.state.meta.errors[0]?.message;
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

          <form.Field name="destinations" validators={{ onChange: tripDestinationsSchema }}>
            {(field) => (
              <Field>
                <p className="text-label-xs-regular text-text">목적지</p>
                <DestinationChipsField
                  values={field.state.value}
                  onChange={field.handleChange}
                  maxCount={TRIP_DESTINATIONS_MAX_COUNT}
                  maxLength={TRIP_DESTINATION_MAX_LENGTH}
                />
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              </Field>
            )}
          </form.Field>

          <form.Field
            name="endDate"
            validators={{
              onChange: ({ value, fieldApi }) =>
                tripDatesSchema.safeParse({ startDate: fieldApi.form.getFieldValue("startDate"), endDate: value }).error
                  ?.issues,
            }}
          >
            {(field) => (
              <div className="flex min-w-0 flex-col gap-2">
                <DateRangeField
                  idPrefix={idPrefix}
                  value={{ start: startDate, end: field.state.value }}
                  popupOnly
                  onChange={(next) => {
                    form.setFieldValue("startDate", next.start);
                    field.handleChange(next.end);
                  }}
                />
                <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
              </div>
            )}
          </form.Field>
        </div>
      )}

      {error && !readOnly && (
        <p className="text-center text-body-m-regular mobile:text-body-s-regular text-primary">
          {error instanceof Error ? error.message : "수정에 실패했어요. 다시 시도해주세요."}
        </p>
      )}

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
