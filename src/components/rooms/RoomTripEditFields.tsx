"use client";

import { useState, type ReactNode } from "react";

import { CloseIcon } from "@/assets/icons";
import { DateRangeField } from "@/components/date-picker/DateRangeField";
import { DestinationSearchInput } from "@/components/search/DestinationSearchInput";
import {
  isTripScheduleDayLimitExceeded,
  TRIP_SCHEDULE_DAY_LIMIT_MESSAGE,
} from "@/lib/plan/schedulePolicy";
import {
  isTripDateRangeInvalid,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  TRIP_DATE_RANGE_INVALID_MESSAGE,
  TRIP_DESTINATION_MAX_LENGTH,
  TRIP_DESTINATIONS_MAX_COUNT,
  type TripFormValues,
} from "@/lib/rooms/trip-form";
import { cn } from "@/lib/utils";

const FIELD_BOX_CLASS =
  "flex h-12 w-full min-w-0 items-center rounded-lg border border-border bg-fill-subtle pl-3.5 pr-2.5 text-body-m-regular mobile:text-body-s-regular text-text-subtle";
const MESSAGE_CLASS = "text-body-s-regular mobile:text-body-xs-regular text-primary";

type Props = {
  idPrefix: string;
  values: TripFormValues;
  readOnly?: boolean;
  onTitleChange: (value: string) => void;
  onDestinationsChange: (next: string[]) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

function Field({ label, htmlFor, className, children }: Readonly<{ label: string; htmlFor?: string; className?: string; children: ReactNode }>) {
  const LabelTag = htmlFor ? "label" : "p";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <LabelTag {...(htmlFor ? { htmlFor } : {})} className="text-label-xs-regular text-text">
        {label}
      </LabelTag>
      {children}
    </div>
  );
}

/** 여행 정보 수정 모달 전용 입력 필드 — 새 여행 만들기(`TripFormFields`)와 분리 */
export function RoomTripEditFields({
  idPrefix,
  values,
  readOnly = false,
  onTitleChange,
  onDestinationsChange,
  onStartDateChange,
  onEndDateChange,
}: Readonly<Props>) {
  const { title, destinations, startDate, endDate } = values;
  const [destinationDraft, setDestinationDraft] = useState("");
  const [destinationWarning, setDestinationWarning] = useState<string | null>(null);
  const destinationsFull = destinations.length >= TRIP_DESTINATIONS_MAX_COUNT;
  const dateRangeInvalid = isTripDateRangeInvalid(startDate, endDate);
  const scheduleDayLimitExceeded = isTripScheduleDayLimitExceeded(startDate, endDate);
  let dateMessage = null;
  if (dateRangeInvalid) dateMessage = TRIP_DATE_RANGE_INVALID_MESSAGE;
  else if (scheduleDayLimitExceeded) dateMessage = TRIP_SCHEDULE_DAY_LIMIT_MESSAGE;

  function addDestination(place: { description: string; placeId: string } | null) {
    if (!place) return;
    const next = place.description.trim().slice(0, TRIP_DESTINATION_MAX_LENGTH);
    setDestinationDraft("");
    if (!next) return;
    if (destinations.includes(next)) {
      setDestinationWarning("이미 추가한 여행지예요");
      return;
    }
    if (destinationsFull) {
      setDestinationWarning(`여행지는 최대 ${TRIP_DESTINATIONS_MAX_COUNT}개까지 추가할 수 있어요`);
      return;
    }
    setDestinationWarning(null);
    onDestinationsChange([...destinations, next]);
  }

  if (readOnly) {
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <Field label="여행 제목">
          <p className={FIELD_BOX_CLASS}><span className="truncate">{title.trim() || "—"}</span></p>
        </Field>
        <Field label="목적지">
          <p className={FIELD_BOX_CLASS}><span className="truncate">{destinations.join(", ") || "—"}</span></p>
        </Field>
        <DateRangeField
          idPrefix={idPrefix}
          value={{ start: startDate, end: endDate }}
          readOnly
          onChange={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Field label="여행 제목" htmlFor={`${idPrefix}-title`}>
        <input
          id={`${idPrefix}-title`}
          type="text"
          value={title}
          maxLength={ROOM_TRIP_TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value.slice(0, ROOM_TRIP_TITLE_MAX_LENGTH))}
          placeholder="예: 봄 일본 여행, 하와이 신혼여행"
          className={cn(FIELD_BOX_CLASS, "outline-none placeholder:text-text-disabled focus:border-primary")}
        />
      </Field>

      <Field label="목적지">
        {destinationsFull ? (
          <p className={cn(FIELD_BOX_CLASS, "text-text-disabled")}>
            최대 {TRIP_DESTINATIONS_MAX_COUNT}개까지 추가할 수 있어요
          </p>
        ) : (
          <DestinationSearchInput
            value={destinationDraft}
            onChange={setDestinationDraft}
            onResolvedPlace={addDestination}
            placeholder="여행지를 검색해 선택하세요"
            selectionOnly
            showLeadingIcon={false}
            appearance="field"
          />
        )}
        {destinations.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {destinations.map((destination, index) => (
              <span
                key={`${destination}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary-subtle py-1 pl-3 pr-1.5 text-label-m-regular text-primary"
              >
                {destination}
                <button
                  type="button"
                  onClick={() => {
                    onDestinationsChange(destinations.filter((_, i) => i !== index));
                    setDestinationWarning(null);
                  }}
                  aria-label={`${destination} 삭제`}
                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                >
                  <CloseIcon size={16} />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {destinationWarning ? <p className={MESSAGE_CLASS}>{destinationWarning}</p> : null}
      </Field>

      <div className="flex min-w-0 flex-col gap-2">
        {/* 스크롤되는 모달이고 칸 폭(약 176px)에 맞추면 달력이 절반 크기가 되어 팝업으로 띄운다 */}
        <DateRangeField
          idPrefix={idPrefix}
          value={{ start: startDate, end: endDate }}
          popupOnly
          onChange={(next) => {
            onStartDateChange(next.start);
            onEndDateChange(next.end);
          }}
        />
        {dateMessage ? <p className={MESSAGE_CLASS}>{dateMessage}</p> : null}
      </div>
    </div>
  );
}
