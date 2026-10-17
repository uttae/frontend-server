"use client";

import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@ncdai/react-wheel-picker";

import type { YearMonth } from "./calendar";

/** Figma Date Picker `Month` — 행 40px. 링을 크게 잡아 위아래 3행이 시안 간격(40px)에 가깝게 보이고, 284px 밖은 잘라낸다 */
const OPTION_HEIGHT = 40;
const VISIBLE_COUNT = 28;

const CLASS_NAMES = {
  optionItem: "text-title-m text-text-disabled",
  highlightWrapper: "bg-fill text-title-m",
  highlightItem: "text-text",
};

/** 연도·월 휠 — `min`보다 이른 달은 고를 수 없다 */
export function MonthYearWheel({
  value,
  min,
  fromYear,
  toYear,
  onChange,
}: Readonly<{
  value: YearMonth;
  min?: YearMonth;
  fromYear: number;
  toYear: number;
  onChange: (next: YearMonth) => void;
}>) {
  const yearOptions: WheelPickerOption<number>[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    yearOptions.push({ value: year, label: `${year}년` });
  }
  const monthOptions: WheelPickerOption<number>[] = Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: `${month + 1}월`,
    disabled: min != null && value.year === min.year && month < min.month,
  }));

  function change(year: number, month: number) {
    const clampedMonth = min && year === min.year ? Math.max(month, min.month) : month;
    onChange({ year, month: clampedMonth });
  }

  return (
    <div className="relative flex h-[284px] w-full items-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-md bg-fill"
      />
      <WheelPickerWrapper className="justify-center gap-4">
        <div role="group" aria-label="연도" className="w-[100px]">
          <WheelPicker
            classNames={CLASS_NAMES}
            optionItemHeight={OPTION_HEIGHT}
            visibleCount={VISIBLE_COUNT}
            options={yearOptions}
            value={value.year}
            onValueChange={(year) => change(year, value.month)}
          />
        </div>
        <div role="group" aria-label="월" className="w-[68px]">
          <WheelPicker
            classNames={CLASS_NAMES}
            optionItemHeight={OPTION_HEIGHT}
            visibleCount={VISIBLE_COUNT}
            options={monthOptions}
            value={value.month}
            onValueChange={(month) => change(value.year, month)}
          />
        </div>
      </WheelPickerWrapper>
    </div>
  );
}
