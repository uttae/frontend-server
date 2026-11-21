"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type CSSProperties } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { DATE_RANGE_CALENDAR_MAX_HEIGHT } from "@/components/date-picker/DateRangeCalendar";
import { DATE_RANGE_CALENDAR_OFFSET, DateRangePicker } from "@/components/date-picker/DateRangePicker";
import { DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldBox,
  FieldBoxHeader,
  FieldBoxInput,
  FieldBoxLabel,
  FieldBoxRow,
  FieldError,
  FieldSuffix,
} from "@/components/ui/field";

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

const LOGO_BLOCK_HEIGHT = 94;
const LOGO_TO_FIELDS_GAP = 35;
const FIELD_HEIGHT = 70;
const FIELD_ROW_GAP = 14;
const PAGE_TOP_TO_OPEN_CALENDAR_BOTTOM =
  LOGO_BLOCK_HEIGHT +
  LOGO_TO_FIELDS_GAP +
  FIELD_HEIGHT +
  FIELD_ROW_GAP +
  FIELD_HEIGHT +
  DATE_RANGE_CALENDAR_OFFSET +
  DATE_RANGE_CALENDAR_MAX_HEIGHT;
const PAGE_TOP_MIN = 48;
const PAGE_TOP_MAX = 250;
const PAGE_STYLE: CSSProperties & { "--page-top": string } = {
  "--page-top": `clamp(${PAGE_TOP_MIN}px, calc(100dvh - ${PAGE_TOP_TO_OPEN_CALENDAR_BOTTOM}px), ${PAGE_TOP_MAX}px)`,
};

export default function NewTripPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fieldRowRef = useRef<HTMLDivElement>(null);

  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);
  const { mutate: createRoom, isPending, error } = useCreateRoom();

  // 새 여행만 시작일이 오늘 이후여야 한다
  const todayYmd = formatDateYmd(new Date());
  const tripSchema = createTripFormSchema({ startDateMin: todayYmd });
  const tripDatesSchema = createTripDatesSchema({ startDateMin: todayYmd });

  const form = useForm({
    defaultValues: EMPTY_TRIP,
    // 제출 전에 이미 칸 오류가 있으면 TanStack은 첫 제출에서 칸 검사를 건너뛴다. 첫 제출부터 모든 칸 오류를 보이게 한다(저장은 칸 검사가 막는다)
    canSubmitWhenInvalid: true,
    // value는 다듬기 전 값이라 스키마로 trim한 값을 보낸다
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
    <div
      style={PAGE_STYLE}
      className="flex min-h-svh flex-col bg-white px-6 pt-(--page-top) pb-12 mobile:justify-center mobile:pt-12"
    >
      <div className="mx-auto flex w-[640px] flex-col gap-8.75 mobile:w-full">
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
                    <FieldBoxHeader>
                      <FieldBoxLabel render={<label htmlFor={`${ID_PREFIX}-title`} />}>여행 제목</FieldBoxLabel>
                      <FieldSuffix>
                        {field.state.value.length}/{ROOM_TRIP_TITLE_MAX_LENGTH}
                      </FieldSuffix>
                    </FieldBoxHeader>
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
                          // 비워 둔 채 지나가도 오류를 보인다. onBlur validator를 따로 두면 그 오류가 다음 blur까지 남아 입력해도 지워지지 않는다
                          void field.validate("change");
                        }}
                        placeholder="예: 봄 일본 여행, 하와이 신혼여행"
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
            ref={fieldRowRef}
            className="grid min-w-0 grid-cols-2 items-start gap-3 mobile:grid-cols-1 mobile:gap-3.5"
          >
            <form.Field name="destinations" validators={{ onChange: tripDestinationsSchema }}>
              {(field) => (
                <Field>
                  <DestinationChipsField
                    appearance="emphasis"
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
                <Field>
                  <DateRangePicker
                    value={{ start: values.startDate, end: field.state.value }}
                    min={todayYmd}
                    calendarSpanRef={fieldRowRef}
                    onChange={(next) => {
                      form.setFieldValue("startDate", next.start);
                      field.handleChange(next.end);
                    }}
                  />
                  <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                </Field>
              )}
            </form.Field>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {error && (
            <p className="text-center text-body-m-regular mobile:text-body-s-regular text-primary">
              {error instanceof Error ? error.message : "방 생성에 실패했어요. 다시 시도해주세요."}
            </p>
          )}
          <Button
            size="lg"
            tone="brand"
            className="w-full"
            loading={isPending}
            loadingLabel="여행 만드는 중"
            // 규칙 위반으로는 잠그지 않는다. 틀린 채 누르면 handleSubmit이 칸 검사로 막고 틀린 칸 아래에 오류를 보인다
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
