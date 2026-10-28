export const SCHEDULE_TRAVEL_MODES = [
  { value: "WALKING", label: "도보" },
  { value: "TRANSIT", label: "대중교통" },
  { value: "DRIVING", label: "자동차" },
] as const;

export type ScheduleTravelModeValue =
  (typeof SCHEDULE_TRAVEL_MODES)[number]["value"];

const API_VALUES = new Set<string>(
  SCHEDULE_TRAVEL_MODES.map((m) => m.value),
);

/**
 * API·쿼리스트링에 쓸 표준 이동 수단 코드.
 * 미지원·미설정 값은 `null`로 유지하며 자동 조회나 다른 수단으로 대체하지 않습니다.
 */
export function canonicalScheduleTravelMode(
  mode: string | null | undefined,
): ScheduleTravelModeValue | null {
  const raw = typeof mode === "string" ? mode.trim() : "";
  if (!raw.length) return null;
  const upper = raw.toUpperCase();
  if (upper === "WALK") return "WALKING";
  if (API_VALUES.has(upper))
    return upper as ScheduleTravelModeValue;
  return null;
}

export function scheduleTravelModeLabel(mode: string): string {
  const canon = canonicalScheduleTravelMode(mode);
  if (canon) {
    const row = SCHEDULE_TRAVEL_MODES.find((m) => m.value === canon);
    if (row) return row.label;
  }
  return "이동수단 선택";
}
