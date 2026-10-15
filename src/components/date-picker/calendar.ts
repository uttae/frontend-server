import { formatDateYmd, parseLocalYmd, WEEKDAYS_KO } from "@/lib/plan/tripRange";

/** 값은 모두 `YYYY-MM-DD` 문자열, 빈 문자열은 미선택 */
export type DateRange = { start: string; end: string };

/** 다음 클릭이 채울 기간 끝 */
export type RangeEdge = "start" | "end";

/** `month`는 0~11 */
export type YearMonth = { year: number; month: number };

const MS_PER_DAY = 86_400_000;

export function toYearMonth(ymd: string): YearMonth {
  const d = parseLocalYmd(ymd);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthIndex({ year, month }: YearMonth): number {
  return year * 12 + month;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function addDays(ymd: string, delta: number): string {
  const d = parseLocalYmd(ymd);
  return formatDateYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
}

/** 일요일 시작 주 단위 — 앞뒤 빈칸은 `null` */
export function buildMonthWeeks({ year, month }: YearMonth): (string | null)[][] {
  const leading = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= dayCount; day++) {
    cells.push(formatDateYmd(new Date(year, month, day)));
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 시작 칸에서는 새 기간을 시작하고, 종료 칸에서는 시작일 이후 날짜로 기간을 닫는다 */
export function pickRangeDate(
  range: DateRange,
  edge: RangeEdge,
  ymd: string,
): { range: DateRange; edge: RangeEdge } {
  if (edge === "start" || !range.start || ymd < range.start) {
    return { range: { start: ymd, end: "" }, edge: "end" };
  }
  return { range: { start: range.start, end: ymd }, edge: "start" };
}

/** `2026-09-20` → `26/09/20` */
export function formatYmdSlash(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${y.slice(-2)}/${m}/${d}` : "";
}

/** `2026-09-20` → `2026년 9월 20일 일요일` (스크린리더용) */
export function formatYmdKoreanFull(ymd: string): string {
  const d = parseLocalYmd(ymd);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KO[d.getDay()]}요일`;
}

/** `2026-10-24` → `10.24 토` */
function formatMonthDayWeekday(ymd: string): string {
  const d = parseLocalYmd(ymd);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd} ${WEEKDAYS_KO[d.getDay()]}`;
}

/** 헤더 요약 — `10.24 토` 또는 `10.24 토 - 11.18 수 (25박)` */
export function formatSelectionSummary({ start, end }: DateRange): string {
  if (!start) return "날짜를 선택해 주세요";
  if (!end || end === start) return formatMonthDayWeekday(start);
  const nights = Math.round(
    (parseLocalYmd(end).getTime() - parseLocalYmd(start).getTime()) / MS_PER_DAY,
  );
  return `${formatMonthDayWeekday(start)} - ${formatMonthDayWeekday(end)} (${nights}박)`;
}
