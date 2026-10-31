"use client";

import { DateRangeField } from "@/components/date-picker/DateRangeField";
import { DestinationChipsField } from "@/components/rooms/DestinationChipsField";
import { Field, FieldHeader, FieldLabel, FieldSuffix } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

type Props = {
  idPrefix: string;
  values: TripFormValues;
  autoFocusTitle?: boolean;
  startDateMin?: string;
  onTitleChange: (value: string) => void;
  onDestinationsChange: (next: string[]) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

/** 새 여행 만들기 입력 필드. 칸 모양과 배치는 여행 정보 수정(`RoomTripEditFields`)과 같은 Figma Text Field이고, 글자 수만 Header Suffix로 더 보인다 */
export function TripFormFields({
  idPrefix,
  values,
  autoFocusTitle = false,
  startDateMin,
  onTitleChange,
  onDestinationsChange,
  onStartDateChange,
  onEndDateChange,
}: Props) {
  const { title, destinations, startDate, endDate } = values;
  let dateMessage = null;
  if (startDateMin != null && isTripStartBeforeMin(startDate, startDateMin)) dateMessage = TRIP_START_BEFORE_MIN_MESSAGE;
  else if (isTripDateRangeInvalid(startDate, endDate)) dateMessage = TRIP_DATE_RANGE_INVALID_MESSAGE;
  else if (isTripScheduleDayLimitExceeded(startDate, endDate)) dateMessage = TRIP_SCHEDULE_DAY_LIMIT_MESSAGE;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Field>
        <FieldHeader>
          <FieldLabel htmlFor={`${idPrefix}-title`}>여행 제목</FieldLabel>
          <FieldSuffix>
            {title.length}/{ROOM_TRIP_TITLE_MAX_LENGTH}
          </FieldSuffix>
        </FieldHeader>
        <Input
          id={`${idPrefix}-title`}
          type="text"
          value={title}
          maxLength={ROOM_TRIP_TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value.slice(0, ROOM_TRIP_TITLE_MAX_LENGTH))}
          placeholder="예: 봄 일본 여행, 하와이 신혼여행"
          autoFocus={autoFocusTitle}
        />
      </Field>

      <Field>
        <FieldHeader>
          {/* 검색 입력이 DestinationSearchInput 안에 있어 label로 잇지 못한다. 입력 이름은 aria-label '목적지 검색'이다 */}
          <p className="min-w-0 flex-1 text-label-xs-regular text-text">목적지</p>
          <FieldSuffix>
            {destinations.length}/{TRIP_DESTINATIONS_MAX_COUNT}
          </FieldSuffix>
        </FieldHeader>
        <DestinationChipsField
          values={destinations}
          onChange={onDestinationsChange}
          maxCount={TRIP_DESTINATIONS_MAX_COUNT}
          maxLength={TRIP_DESTINATION_MAX_LENGTH}
        />
      </Field>

      <div className="flex min-w-0 flex-col gap-2">
        <DateRangeField
          idPrefix={idPrefix}
          value={{ start: startDate, end: endDate }}
          min={startDateMin}
          onChange={(next) => {
            onStartDateChange(next.start);
            onEndDateChange(next.end);
          }}
        />
        {dateMessage ? (
          <p className="text-body-s-regular mobile:text-body-xs-regular text-primary">{dateMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
