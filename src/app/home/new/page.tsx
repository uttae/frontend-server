"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { DestinationChipList, DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import { TripDatesField } from "@/components/rooms/TripDatesField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldBox, FieldBoxInput, FieldBoxLabel, FieldBoxRow, FieldError } from "@/components/ui/field";

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
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const ID_PREFIX = "new-trip";
const EMPTY_TRIP: TripFormValues = { title: "", destinations: [], startDate: "", endDate: "" };

export default function NewTripPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const datesRowRef = useRef<HTMLDivElement>(null);

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
    <div className="flex min-h-svh flex-col items-center justify-center bg-fill px-6 py-12 has-data-[trip-dates-open]:justify-start has-data-[trip-dates-open]:pt-[clamp(48px,calc(100dvh-910px),calc((100dvh-444px)/2))]">
      <div className="flex w-[674px] max-w-full flex-col gap-8.75">
        <div className="flex flex-col items-center gap-5">
          <Link
            href="/home"
            className="inline-flex rounded-md transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <BrandLogo alt="로고" variant="combination" size="M" className="h-10 w-auto" />
          </Link>
          <h1 className="text-center text-heading-s text-black">새로운 여행 계획하기</h1>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <form.Field name="title" validators={{ onChange: tripTitleSchema }}>
            {(field) => {
              const fieldError = field.state.meta.errors[0]?.message;
              return (
                <Field>
                  <FieldBox>
                    <FieldBoxLabel render={<label htmlFor={`${ID_PREFIX}-title`} />}>여행 제목</FieldBoxLabel>
                    <FieldBoxRow>
                      <FieldBoxInput
                        id={`${ID_PREFIX}-title`}
                        type="text"
                        value={field.state.value}
                        maxLength={ROOM_TRIP_TITLE_MAX_LENGTH}
                        aria-invalid={fieldError ? true : undefined}
                        aria-describedby={fieldError ? `${ID_PREFIX}-title-error` : undefined}
                        onChange={(event) =>
                          field.handleChange(event.target.value.slice(0, ROOM_TRIP_TITLE_MAX_LENGTH))
                        }
                        onBlur={() => {
                          field.handleBlur();
                          void field.validate("change");
                        }}
                        placeholder="예: 봄 일본 여행, 하와이 신혼 여행"
                        autoFocus
                      />
                    </FieldBoxRow>
                  </FieldBox>
                  <FieldError id={`${ID_PREFIX}-title-error`}>{fieldError}</FieldError>
                </Field>
              );
            }}
          </form.Field>

          <div
            ref={datesRowRef}
            className="group/trip-row grid min-w-0 grid-flow-row-dense grid-cols-2 items-start gap-3 max-md:grid-cols-1 max-md:gap-3.5 mobile:grid-cols-1 mobile:gap-3.5"
          >
            <form.Field name="destinations" validators={{ onChange: tripDestinationsSchema }}>
              {(field) => (
                <>
                  <Field>
                    <DestinationChipsField
                      values={field.state.value}
                      onChange={field.handleChange}
                      maxCount={TRIP_DESTINATIONS_MAX_COUNT}
                      maxLength={TRIP_DESTINATION_MAX_LENGTH}
                    />
                    <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                  </Field>
                  <DestinationChipList
                    values={field.state.value}
                    onChange={field.handleChange}
                    className="col-span-full group-has-data-[trip-dates-open]/trip-row:invisible"
                  />
                </>
              )}
            </form.Field>

            <form.Field
              name="endDate"
              validators={{
                onChange: ({ value, fieldApi }) =>
                  tripDatesSchema.safeParse({ startDate: fieldApi.form.getFieldValue("startDate"), endDate: value })
                    .error?.issues,
              }}
            >
              {(field) => (
                <TripDatesField
                  variant="edit"
                  value={{ start: values.startDate, end: field.state.value }}
                  min={todayYmd}
                  error={field.state.meta.errors[0]?.message}
                  desktopPicker={{ presentation: "anchored", rowRef: datesRowRef }}
                  onChange={(next) => {
                    form.setFieldValue("startDate", next.start);
                    field.handleChange(next.end);
                  }}
                />
              )}
            </form.Field>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {error && (
            <p className="text-center text-body-m-regular max-md:text-body-s-regular mobile:text-body-s-regular text-primary">
              {error instanceof Error ? error.message : "방 생성에 실패했어요. 다시 시도해주세요."}
            </p>
          )}
          <Button
            size="lg"
            tone="brand"
            className="w-full"
            loading={isPending}
            loadingLabel="여행 만드는 중"
            onClick={() => void form.handleSubmit()}
          >
            여행 시작하기
          </Button>
          <Link href="/home" className={cn(buttonVariants({ variant: "text", tone: "neutral", size: "lg" }), "w-full")}>
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
