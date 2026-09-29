/**
 * 로그인 시 사용자별 키(`…:v1:<userId>`), 비로그인 시 userId 없는 키(`…:v1`)에 저장한다.
 * 로그인하면 자기 키만 읽으므로 다른 계정·비로그인 기록은 보이지 않는다. 로그아웃해도 지우지 않는다.
 */
const STORAGE_KEY = "hau:map-search-history:v1";

const MAX_ENTRIES = 10;

/** 자동완성에서 고른 장소 */
export type MapSearchPlaceEntry = {
  type: "place";
  googlePlaceId: string;
  name: string;
  address: string;
};

/** 엔터로 확정한 텍스트 검색어 */
export type MapSearchQueryEntry = {
  type: "query";
  query: string;
};

export type MapSearchHistoryEntry = MapSearchPlaceEntry | MapSearchQueryEntry;

function storageKey(userId: number | undefined): string {
  return userId == null ? STORAGE_KEY : `${STORAGE_KEY}:${userId}`;
}

export function mapSearchHistoryEntryKey(entry: MapSearchHistoryEntry): string {
  return entry.type === "place" ? `place:${entry.googlePlaceId}` : `query:${entry.query}`;
}

function parseEntry(value: unknown): MapSearchHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (o.type === "query") {
    return typeof o.query === "string" && o.query.trim().length > 0
      ? { type: "query", query: o.query }
      : null;
  }
  // type 없는 항목은 장소 기록만 있던 시절에 저장된 것
  if (
    typeof o.googlePlaceId === "string" &&
    o.googlePlaceId.length > 0 &&
    typeof o.name === "string" &&
    typeof o.address === "string"
  ) {
    return { type: "place", googlePlaceId: o.googlePlaceId, name: o.name, address: o.address };
  }
  return null;
}

function save(userId: number | undefined, entries: MapSearchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

/** 모바일 지도 검색 기록(고른 장소·엔터 검색어) — 최근 순 */
export function readMapSearchHistory(userId: number | undefined): MapSearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseEntry).filter((e): e is MapSearchHistoryEntry => e !== null);
  } catch {
    return [];
  }
}

/** 맨 앞에 추가(같은 항목은 앞으로 이동)하고 결과 목록을 돌려준다 */
export function addMapSearchHistory(
  userId: number | undefined,
  entry: MapSearchHistoryEntry,
): MapSearchHistoryEntry[] {
  const key = mapSearchHistoryEntryKey(entry);
  const next = [
    entry,
    ...readMapSearchHistory(userId).filter((e) => mapSearchHistoryEntryKey(e) !== key),
  ].slice(0, MAX_ENTRIES);
  save(userId, next);
  return next;
}

export function removeMapSearchHistory(
  userId: number | undefined,
  entry: MapSearchHistoryEntry,
): MapSearchHistoryEntry[] {
  const key = mapSearchHistoryEntryKey(entry);
  const next = readMapSearchHistory(userId).filter((e) => mapSearchHistoryEntryKey(e) !== key);
  save(userId, next);
  return next;
}
