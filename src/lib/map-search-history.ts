const STORAGE_KEY = "hau:map-search-history:v1";

const MAX_ENTRIES = 10;

export type MapSearchPlaceEntry = {
  type: "place";
  googlePlaceId: string;
  name: string;
  address: string;
};

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
    return typeof o.query === "string" && o.query.trim().length > 0 ? { type: "query", query: o.query } : null;
  }
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
  } catch {}
}

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

export function addMapSearchHistory(userId: number | undefined, entry: MapSearchHistoryEntry): MapSearchHistoryEntry[] {
  const key = mapSearchHistoryEntryKey(entry);
  const next = [entry, ...readMapSearchHistory(userId).filter((e) => mapSearchHistoryEntryKey(e) !== key)].slice(
    0,
    MAX_ENTRIES,
  );
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
