import { useRef, type RefObject } from "react";

import { CalendarIcon } from "@/assets/icons";
import { FieldBox, FieldBoxHeader, FieldBoxLabel, FieldBoxRow } from "@/components/ui/field";
import { useMobileView } from "@/contexts/MobileViewContext";
import { cn } from "@/lib/utils";

import { formatYmdKoreanFull, formatYmdSlash, type DateRange } from "./calendar";
import { DatePicker } from "./DatePicker";
import { DatePickerLayer } from "./DatePickerLayer";
import { DateRangeCalendar } from "./DateRangeCalendar";
import { useDateRangeDraft } from "./useDateRangeDraft";

export const DATE_RANGE_CALENDAR_OFFSET = 7;

const PLACEHOLDER = "YY/MM/DD";

function describeDate(ymd: string) {
  return ymd ? formatYmdKoreanFull(ymd) : "선택 안 됨";
}

export function DateRangePicker({
  value,
  min,
  calendarSpanRef,
  onChange,
}: Readonly<{
  value: DateRange;
  min?: string;
  calendarSpanRef: RefObject<HTMLElement | null>;
  onChange: (next: DateRange) => void;
}>) {
  const { isMobileDevice } = useMobileView();
  const fieldRef = useRef<HTMLDivElement>(null);
  const draft = useDateRangeDraft(value, onChange);
  const { start, end } = draft.range;

  function calendarAnchor() {
    const span = calendarSpanRef.current;
    const field = fieldRef.current;
    if (!span || !field) return null;
    return {
      contextElement: span,
      getBoundingClientRect() {
        const spanRect = span.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        return new DOMRect(spanRect.left, fieldRect.top, spanRect.width, fieldRect.height);
      },
    };
  }

  return (
    <div ref={fieldRef} className="min-w-0">
      <FieldBox
        control="trigger"
        render={
          <button
            type="button"
            aria-label={`일정, 시작 날짜 ${describeDate(start)}, 종료 날짜 ${describeDate(end)}`}
            aria-haspopup="dialog"
            aria-expanded={draft.isOpen}
            onClick={() => {
              if (!draft.isOpen) draft.open(start && !end ? "end" : "start");
            }}
          />
        }
      >
        <FieldBoxHeader>
          <FieldBoxLabel>일정</FieldBoxLabel>
        </FieldBoxHeader>
        <FieldBoxRow>
          <CalendarIcon size={20} className="shrink-0 text-icon-subtle" />
          <span className="truncate px-1">
            <span className={cn(!start && "text-text-subtle")}>{formatYmdSlash(start) || PLACEHOLDER}</span>
            <span className={cn(!(start && end) && "text-text-subtle")}> - </span>
            <span className={cn(!end && "text-text-subtle")}>{formatYmdSlash(end) || PLACEHOLDER}</span>
          </span>
        </FieldBoxRow>
      </FieldBox>
      {draft.isOpen ? (
        <DatePickerLayer
          placement={
            isMobileDevice
              ? { presentation: "popup" }
              : {
                  presentation: "anchored",
                  anchor: calendarAnchor,
                  boundaryRef: fieldRef,
                  sideOffset: DATE_RANGE_CALENDAR_OFFSET,
                }
          }
          label="일정 선택"
          onDismiss={draft.confirm}
          onEscape={draft.cancel}
        >
          {isMobileDevice ? (
            <DatePicker
              value={draft.range}
              min={min}
              onSelect={draft.pick}
              onCancel={draft.cancel}
              onConfirm={draft.confirm}
            />
          ) : (
            <DateRangeCalendar
              value={draft.range}
              min={min}
              onSelect={draft.pick}
              onCancel={draft.cancel}
              onConfirm={draft.confirm}
            />
          )}
        </DatePickerLayer>
      ) : null}
    </div>
  );
}
