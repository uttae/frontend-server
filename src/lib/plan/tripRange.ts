export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseLocalYmd(s: string): Date {
  const parts = s.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    return startOfLocalDay(new Date());
  }
  return new Date(y, m - 1, d);
}

export function formatDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatKoreanDateLabel(d: Date): string {
  const w = WEEKDAYS_KO[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`;
}

function formatYmdKoShort(ymd: string): string {
  const d = parseLocalYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatTripYmdRangeShortKo(
  startYmd: string | null | undefined,
  endYmd: string | null | undefined,
): string {
  const s = startYmd?.trim() ?? "";
  const e = endYmd?.trim() ?? "";
  if (!s || !e) return "";
  if (s === e) return formatYmdKoShort(s);
  return `${formatYmdKoShort(s)} ~ ${formatYmdKoShort(e)}`;
}

export function formatRoomTripSubtitle(startYmd: string, endYmd: string): string {
  const s = startYmd.trim();
  const e = endYmd.trim();
  if (!s || !e) return "일정 없음";
  const monthDay = (ymd: string) => ymd.slice(5).replace("-", "/");
  if (s === e) return monthDay(s);
  return `${monthDay(s)} ~ ${monthDay(e)}`;
}

export type RoomTripYmdSource = {
  id: string;
  startDate: string | null;
  endDate: string | null;
};

export function tripYmdBoundsFromRoomSources(
  roomId: string,
  listRooms: RoomTripYmdSource[] | undefined,
  detailFallback: RoomTripYmdSource | null | undefined,
): { startYmd: string; endYmd: string } {
  if (!roomId.length) return { startYmd: "", endYmd: "" };
  const fromList = listRooms?.find((r) => r.id === roomId);
  if (fromList?.startDate && fromList?.endDate) {
    return { startYmd: fromList.startDate, endYmd: fromList.endDate };
  }
  if (detailFallback?.id === roomId && detailFallback.startDate && detailFallback.endDate) {
    return {
      startYmd: detailFallback.startDate,
      endYmd: detailFallback.endDate,
    };
  }
  return { startYmd: "", endYmd: "" };
}
