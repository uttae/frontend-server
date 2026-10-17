"use client";

import { useRef } from "react";

import { CalendarIcon } from "@/assets/icons";
import { useMobileView } from "@/contexts/MobileViewContext";
import { cn } from "@/lib/utils";

import { formatYmdKoreanFull, formatYmdSlash, type DateRange, type RangeEdge } from "./calendar";
import { DatePicker } from "./DatePicker";
import { DatePickerLayer } from "./DatePickerLayer";
import { useDateRangeDraft } from "./useDateRangeDraft";

const FIELDS: { edge: RangeEdge; label: string }[] = [
  { edge: "start", label: "시작 날짜" },
  { edge: "end", label: "종료 날짜" },
];

/**
 * Figma Date Picker Usage `Input Field와 함께 쓰일 때` — `Text Field Emphasis` 두 칸과 기간 달력.
 * 웹은 누른 칸 아래에 그 칸 폭으로 붙이고, 모바일·`popupOnly`는 팝업으로 띄운다.
 */
export function DateRangeField({
  idPrefix,
  value,
  min,
  readOnly = false,
  popupOnly = false,
  onChange,
}: Readonly<{
  idPrefix: string;
  value: DateRange;
  /** 이보다 이른 날짜는 고를 수 없다 (`YYYY-MM-DD`) */
  min?: string;
  readOnly?: boolean;
  /** 스크롤되는 모달처럼 칸 아래에 붙이기 어려운 곳 */
  popupOnly?: boolean;
  onChange: (next: DateRange) => void;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobileDevice } = useMobileView();
  const draft = useDateRangeDraft(value, onChange);
  const presentation = popupOnly || isMobileDevice ? "popup" : "anchored";

  const picker = draft.isOpen ? (
    <DatePickerLayer
      presentation={presentation}
      boundaryRef={containerRef}
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
  ) : null;

  return (
    <div ref={containerRef} className="grid min-w-0 grid-cols-2 gap-2">
      {FIELDS.map(({ edge, label }) => {
        const ymd = draft.range[edge];
        const focused = draft.activeEdge === edge;
        const text = (
          <span className="flex h-8 w-full min-w-0 items-center gap-1">
            <CalendarIcon size={20} className={cn("shrink-0", readOnly ? "text-icon-disabled" : "text-icon-subtle")} />
            <span
              className={cn(
                "truncate px-1 text-body-m-regular",
                ymd && !readOnly ? "text-text" : "text-text-subtle",
              )}
            >
              {formatYmdSlash(ymd) || "YY/MM/DD"}
            </span>
          </span>
        );

        return (
          <div key={edge} className="relative min-w-0">
            {readOnly ? (
              <div className="flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-border bg-fill pb-1.5 pl-3 pr-2 pt-3">
                <span className="pl-1 pr-2 text-label-xs-regular text-text-subtle">{label}</span>
                {text}
              </div>
            ) : (
              <button
                id={`${idPrefix}-${edge}`}
                type="button"
                aria-label={`${label} ${ymd ? formatYmdKoreanFull(ymd) : "선택 안 됨"}`}
                aria-haspopup="dialog"
                aria-expanded={focused}
                onClick={() => draft.open(edge)}
                className={cn(
                  "flex w-full min-w-0 cursor-pointer flex-col gap-0.5 rounded-md border bg-fill-subtle pb-1.5 pl-3 pr-2 pt-3 text-left outline-none transition-colors focus-visible:border-primary",
                  focused ? "border-primary" : "border-border",
                )}
              >
                <span className={cn("pl-1 pr-2 text-label-xs-regular", focused ? "text-primary-strong" : "text-text")}>
                  {label}
                </span>
                {text}
              </button>
            )}
            {presentation === "anchored" && draft.anchorEdge === edge ? picker : null}
          </div>
        );
      })}
      {presentation === "popup" ? picker : null}
    </div>
  );
}
