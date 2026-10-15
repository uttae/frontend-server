const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** `YYYY-MM-DD`를 로컬 자정 기준 `Date`로 파싱합니다. */
export function parseLocalYmd(s: string): Date {
  const parts = s.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (
    y === undefined ||
    m === undefined ||
    d === undefined ||
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d)
  ) {
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

/** 일정 일차 헤더용 짧은 날짜 — `10.12(월)` */
export function formatShortDateLabel(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}.${day}(${WEEKDAYS_KO[d.getDay()]})`;
}

function formatYmdKoShort(ymd: string): string {
  const d = parseLocalYmd(ymd);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 홈 카드 등: `YYYY-MM-DD` 범위를 짧은 한글 문구로 (값 없음이면 빈 문자열). */
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

/** 메인 헤더 부제: 서버 동기화된 여행 구간 또는 `일정 없음`. */
export function formatRoomTripSubtitleKo(startYmd: string, endYmd: string): string {
  const s = startYmd.trim();
  const e = endYmd.trim();
  if (!s || !e) return "일정 없음";
  if (s === e) return formatYmdKoShort(s);
  return `${formatYmdKoShort(s)} ~ ${formatYmdKoShort(e)}`;
}

export type RoomTripYmdSource = {
  id: string;
  startDate: string | null;
  endDate: string | null;
};

/** 참여 중인 방 목록 또는 세션 메타에서 여행 `YYYY-MM-DD` 경계를 고릅니다. */
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
  if (
    detailFallback?.id === roomId &&
    detailFallback.startDate &&
    detailFallback.endDate
  ) {
    return {
      startYmd: detailFallback.startDate,
      endYmd: detailFallback.endDate,
    };
  }
  return { startYmd: "", endYmd: "" };
}
