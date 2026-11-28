import { formatDateYmd, parseLocalYmd, WEEKDAYS_KO } from "@/lib/plan/tripRange";

export type DateRange = { start: string; end: string };

export type RangeEdge = "start" | "end";

export type RangeSelection = { range: DateRange; edge: RangeEdge };

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

export const EMPTY_RANGE: DateRange = { start: "", end: "" };

export function pickRangeDate({ range, edge }: RangeSelection, ymd: string): RangeSelection {
  if (edge === "start" || !range.start || ymd < range.start) {
    return { range: { start: ymd, end: range.end >= ymd ? range.end : "" }, edge: "end" };
  }
  return { range: { start: range.start, end: ymd }, edge: "start" };
}

export function formatYmdSlash(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return y && m && d ? `${y.slice(-2)}/${m}/${d}` : "";
}

export function formatYmdKoreanFull(ymd: string): string {
  const d = parseLocalYmd(ymd);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KO[d.getDay()]}요일`;
}

function formatMonthDayWeekday(ymd: string): string {
  const d = parseLocalYmd(ymd);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd} ${WEEKDAYS_KO[d.getDay()]}`;
}

export function formatRangeLabel({ start, end }: DateRange): string {
  if (!start) return "날짜를 선택해 주세요";
  if (!end || end === start) return formatMonthDayWeekday(start);
  return `${formatMonthDayWeekday(start)} - ${formatMonthDayWeekday(end)}`;
}

export function formatSelectionSummary({ start, end }: DateRange): string {
  const label = formatRangeLabel({ start, end });
  if (!start || !end || end === start) return label;
  const nights = Math.round((parseLocalYmd(end).getTime() - parseLocalYmd(start).getTime()) / MS_PER_DAY);
  return `${label} (${nights}박)`;
}
