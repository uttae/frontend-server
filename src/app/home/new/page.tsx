"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/BrandLogo";
import { DateRangeField } from "@/components/date-picker/DateRangeField";
import { DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import { Field, FieldError, FieldHeader, FieldLabel, FieldSuffix } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { bucketTripDays } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { useCreateRoom } from "@/hooks/useRooms";
import type { RoomDetail } from "@/lib/api/rooms";
import { formatDateYmd } from "@/lib/plan/tripRange";
import {
  createTripDatesSchema,
  createTripFormSchema,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  TRIP_DESTINATION_MAX_LENGTH,
  TRIP_DESTINATIONS_MAX_COUNT,
  tripDestinationsSchema,
  tripTitleSchema,
  type TripFormValues,
} from "@/lib/rooms/trip-form";
import { roomDetailQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";

const ID_PREFIX = "new-trip";
const EMPTY_TRIP: TripFormValues = { title: "", destinations: [], startDate: "", endDate: "" };

export default function NewTripPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);
  const { mutate: createRoom, isPending, error } = useCreateRoom();

  const todayYmd = formatDateYmd(new Date());
  const tripSchema = createTripFormSchema({ startDateMin: todayYmd });
  const tripDatesSchema = createTripDatesSchema({ startDateMin: todayYmd });

  const form = useForm({
    defaultValues: EMPTY_TRIP,
    canSubmitWhenInvalid: true,
    onSubmit: ({ value }) => {
      createRoom(tripSchema.parse(value), {
        onSuccess: (room) => {
          trackAnalyticsEvent(AnalyticsEvents.createPlan, {
            room_id: room.id,
            entry_point: "direct",
            trip_days_bucket: bucketTripDays(room.startDate, room.endDate),
          });
          setCurrentRoomId(room.id);
          queryClient.setQueryData<RoomDetail>(roomDetailQueryKey(room.id), room);
          router.push("/plan");
        },
      });
    },
  });
  const values = useStore(form.store, (state) => state.values);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-10 flex justify-center">
          <Link
            href="/home"
            className="inline-flex rounded-md outline-none ring-offset-2 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BrandLogo alt="로고" variant="combination" size="M" />
          </Link>
        </div>

        <h1 className="mb-8 text-center text-heading-m mobile:text-heading-s font-bold tracking-tight text-black">
          새로운 여행 계획하기
        </h1>

        <div className="flex min-w-0 flex-col gap-6">
          <form.Field name="title" validators={{ onChange: tripTitleSchema }}>
            {(field) => {
              const fieldError = field.state.meta.errors[0]?.message;
              return (
                <Field>
                  <FieldHeader>
                    <FieldLabel htmlFor={`${ID_PREFIX}-title`}>여행 제목</FieldLabel>
                    <FieldSuffix>
                      {field.state.value.length}/{ROOM_TRIP_TITLE_MAX_LENGTH}
                    </FieldSuffix>
                  </FieldHeader>
                  <Input
                    id={`${ID_PREFIX}-title`}
                    type="text"
                    value={field.state.value}
                    maxLength={ROOM_TRIP_TITLE_MAX_LENGTH}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? `${ID_PREFIX}-title-error` : undefined}
                    onChange={(event) => field.handleChange(event.target.value.slice(0, ROOM_TRIP_TITLE_MAX_LENGTH))}
                    onBlur={() => {
                      field.handleBlur();
                      void field.validate("change");
                    }}
                    placeholder="예: 봄 일본 여행, 하와이 신혼여행"
                    autoFocus
                  />
                  <FieldError id={`${ID_PREFIX}-title-error`}>{fieldError}</FieldError>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="destinations" validators={{ onChange: tripDestinationsSchema }}>
            {(field) => (
              <Field>
                <FieldHeader>
                  <p className="min-w-0 flex-1 text-label-xs-regular text-text">목적지</p>
                  <FieldSuffix>
                    {field.state.value.length}/{TRIP_DESTINATIONS_MAX_COUNT}
                  </FieldSuffix>
                </FieldHeader>
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
                  idPrefix={ID_PREFIX}
                  value={{ start: values.startDate, end: field.state.value }}
                  min={todayYmd}
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

        {error && (
          <p className="mt-3 text-center text-body-m-regular mobile:text-body-s-regular text-primary">
            {error instanceof Error
              ? error.message
              : "방 생성에 실패했어요. 다시 시도해주세요."}
          </p>
        )}

        <button
          type="button"
          onClick={() => void form.handleSubmit()}
          disabled={isPending}
          className="mt-8 w-full rounded-full bg-primary py-4 text-label-xl-emphasis mobile:text-label-l-emphasis font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "생성 중…" : "계획을 시작하세요"}
        </button>

        <Link
          href="/home"
          className="mt-4 block text-center text-label-l-regular mobile:text-label-m-regular font-medium text-dark-gray underline-offset-4 transition hover:text-neutral-900 hover:underline"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
