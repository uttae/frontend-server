"use client";

import { CalendarIcon } from "@/assets/icons";
import { FieldBox, FieldBoxHeader, FieldBoxLabel, FieldBoxRow } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { formatYmdKoreanFull, formatYmdSlash, type DateRange, type RangeEdge } from "./calendar";
import { DatePicker } from "./DatePicker";
import { DatePickerLayer } from "./DatePickerLayer";
import { useDateRangeDraft } from "./useDateRangeDraft";

const FIELDS: { edge: RangeEdge; label: string }[] = [
  { edge: "start", label: "시작 날짜" },
  { edge: "end", label: "종료 날짜" },
];

export function DateRangeField({
  idPrefix,
  value,
  min,
  readOnly = false,
  onChange,
}: Readonly<{
  idPrefix: string;
  value: DateRange;

  min?: string;
  readOnly?: boolean;
  onChange: (next: DateRange) => void;
}>) {
  const draft = useDateRangeDraft(value, onChange);

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2">
      {FIELDS.map(({ edge, label }) => {
        const ymd = draft.range[edge];
        return (
          <FieldBox
            key={edge}
            control={readOnly ? "readOnly" : "trigger"}
            render={
              readOnly ? undefined : (
                <button
                  id={`${idPrefix}-${edge}`}
                  type="button"
                  aria-label={`${label} ${ymd ? formatYmdKoreanFull(ymd) : "선택 안 됨"}`}
                  aria-haspopup="dialog"
                  aria-expanded={draft.activeEdge === edge}
                  onClick={() => draft.open(edge)}
                />
              )
            }
          >
            <FieldBoxHeader>
              <FieldBoxLabel>{label}</FieldBoxLabel>
            </FieldBoxHeader>
            <FieldBoxRow>
              <CalendarIcon
                size={20}
                className={cn("shrink-0", readOnly ? "text-icon-disabled" : "text-icon-subtle")}
              />
              <span className={cn("truncate px-1", ymd && !readOnly ? "text-text" : "text-text-subtle")}>
                {formatYmdSlash(ymd) || "YY/MM/DD"}
              </span>
            </FieldBoxRow>
          </FieldBox>
        );
      })}
      {draft.isOpen ? (
        <DatePickerLayer
          placement={{ presentation: "popup" }}
          label="날짜 선택"
          onDismiss={draft.confirm}
          onEscape={draft.cancel}
        >
          <DatePicker
            value={draft.range}
            min={min}
            onSelect={draft.pick}
            onCancel={draft.cancel}
            onConfirm={draft.confirm}
          />
        </DatePickerLayer>
      ) : null}
    </div>
  );
}
