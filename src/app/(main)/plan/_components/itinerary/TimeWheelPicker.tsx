"use client";

import { useState } from "react";

import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@ncdai/react-wheel-picker";

type Period = "AM" | "PM";
type TimeParts = { period: Period | ""; hour: number | ""; minute: number | "" };

/** Figma Time Picker Base — 행 44px, 5행(≈220px)이 보이도록 링 개수 16 */
const OPTION_HEIGHT = 44;
const VISIBLE_COUNT = 16;

const PERIOD_OPTIONS: WheelPickerOption<Period | "">[] = [
  { value: "", label: "--" },
  { value: "AM", label: "오전" },
  { value: "PM", label: "오후" },
];
const HOUR_OPTIONS: WheelPickerOption<number | "">[] = [{ value: "", label: "--" }, ...Array.from(
  { length: 12 },
  (_, i) => ({ value: i, label: String(i) }),
)];
const MINUTE_OPTIONS: WheelPickerOption<number | "">[] = [{ value: "", label: "--" }, ...Array.from(
  { length: 60 },
  (_, i) => ({ value: i, label: String(i).padStart(2, "0") }),
)];

function splitHm(hm: string | null): TimeParts {
  if (!hm) return { period: "", hour: "", minute: "" };
  const [h, m] = hm.split(":").map(Number);
  return { period: h < 12 ? "AM" : "PM", hour: h % 12, minute: m };
}

function joinHm(period: Period, hour: number, minute: number): string {
  const h = hour + (period === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 12시간제 휠 — `value`/`onChange`는 24시간 HH:mm */
export function TimeWheelPicker({
  value,
  onChange,
  active,
  onInteract,
}: Readonly<{
  /** 빈 문자열은 미설정, null은 아직 완성하지 않은 입력입니다. */
  value: string | null;
  onChange: (hm: string | null) => void;
  /** 편집 중인 필드가 있을 때만 중앙 값을 진하게 표시 */
  active: boolean;
  /** 휠을 건드리는 순간 — 편집 대상 필드가 없으면 부모가 지정 */
  onInteract: () => void;
}>) {
  const [partial, setPartial] = useState<TimeParts>(() => splitHm(value));
  const parts = value ? splitHm(value) : partial;
  const { period, hour, minute } = parts;
  function changePart(patch: Partial<TimeParts>) {
    const next = { ...parts, ...patch };
    setPartial(next);
    onChange(next.period !== "" && next.hour !== "" && next.minute !== ""
      ? joinHm(next.period, next.hour, next.minute)
      : next.period === "" && next.hour === "" && next.minute === "" ? "" : null);
  }
  const classNames = {
    optionItem: "text-heading-s text-text-disabled",
    highlightWrapper: "bg-fill text-heading-s",
    highlightItem: active ? "text-text" : "text-text-disabled",
  };
  const shared = {
    classNames,
    optionItemHeight: OPTION_HEIGHT,
    visibleCount: VISIBLE_COUNT,
  };

  return (
    <div
      className="relative w-full p-2"
      onPointerDownCapture={onInteract}
      onWheelCapture={onInteract}
      onKeyDownCapture={(e) => {
        if (e.key !== "Tab" && e.key !== "Escape") onInteract();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-md bg-fill"
      />
      <WheelPickerWrapper className="justify-center gap-2">
        <div role="group" aria-label="오전/오후" className="w-[88px]">
          <WheelPicker
            {...shared}
            options={PERIOD_OPTIONS}
            value={period}
            onValueChange={(next) => changePart({ period: next })}
          />
        </div>
        <div role="group" aria-label="시" className="w-16">
          <WheelPicker
            {...shared}
            infinite
            options={HOUR_OPTIONS}
            value={hour}
            onValueChange={(next) => changePart({ hour: next })}
          />
        </div>
        <div role="group" aria-label="분" className="w-16">
          <WheelPicker
            {...shared}
            infinite
            options={MINUTE_OPTIONS}
            value={minute}
            onValueChange={(next) => changePart({ minute: next })}
          />
        </div>
      </WheelPickerWrapper>
    </div>
  );
}
