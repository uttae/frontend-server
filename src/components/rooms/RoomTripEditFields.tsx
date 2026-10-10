"use client";

import { useState, type ReactNode } from "react";

import { CloseIcon } from "@/assets/icons";
import { DestinationSearchInput } from "@/components/search/DestinationSearchInput";
import {
  isTripScheduleDayLimitExceeded,
  TRIP_SCHEDULE_DAY_LIMIT_MESSAGE,
} from "@/lib/plan/schedulePolicy";
import {
  isTripDateRangeInvalid,
  isTripStartBeforeMin,
  ROOM_TRIP_TITLE_MAX_LENGTH,
  TRIP_DATE_RANGE_INVALID_MESSAGE,
  TRIP_DESTINATION_MAX_LENGTH,
  TRIP_DESTINATIONS_MAX_COUNT,
  TRIP_START_BEFORE_MIN_MESSAGE,
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
  startDateMin?: string;
  endDateMin?: string;
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

/** `2026-10-09` → `2026. 10. 09.` */
function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${y}. ${m}. ${d}.` : "";
}

function DateBox({ id, label, value, min, onChange }: Readonly<{ id: string; label: string; value: string; min?: string; onChange: (value: string) => void }>) {
  return (
    <label
      htmlFor={id}
      className={cn(FIELD_BOX_CLASS, "relative cursor-pointer focus-within:border-primary")}
    >
      <span aria-hidden className={value ? undefined : "text-text-disabled"}>{formatYmd(value) || "날짜 선택"}</span>
      <input
        id={id}
        aria-label={label}
        type="date"
        value={value}
        min={min}
        max="9999-12-31"
        onClick={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.showPicker?.();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.currentTarget.showPicker?.();
        }}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}

/** 여행 정보 수정 모달 전용 입력 필드 — 새 여행 만들기(`TripFormFields`)와 분리 */
export function RoomTripEditFields({
  idPrefix,
  values,
  readOnly = false,
  startDateMin,
  endDateMin,
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
  const startBeforeMin = startDateMin != null && isTripStartBeforeMin(startDate, startDateMin);
  const scheduleDayLimitExceeded = isTripScheduleDayLimitExceeded(startDate, endDate);
  let dateMessage = null;
  if (startBeforeMin) dateMessage = TRIP_START_BEFORE_MIN_MESSAGE;
  else if (dateRangeInvalid) dateMessage = TRIP_DATE_RANGE_INVALID_MESSAGE;
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="시작일"><p className={FIELD_BOX_CLASS}>{formatYmd(startDate) || "—"}</p></Field>
          <Field label="종료일"><p className={FIELD_BOX_CLASS}>{formatYmd(endDate) || "—"}</p></Field>
        </div>
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="시작일" htmlFor={`${idPrefix}-start`}>
            <DateBox id={`${idPrefix}-start`} label="여행 시작일" value={startDate} min={startDateMin} onChange={onStartDateChange} />
          </Field>
          <Field label="종료일" htmlFor={`${idPrefix}-end`}>
            <DateBox id={`${idPrefix}-end`} label="여행 종료일" value={endDate} min={endDateMin} onChange={onEndDateChange} />
          </Field>
        </div>
        {dateMessage ? <p className={MESSAGE_CLASS}>{dateMessage}</p> : null}
      </div>
    </div>
  );
}
