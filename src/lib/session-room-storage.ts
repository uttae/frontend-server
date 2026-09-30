import { parseRoomContextPath } from "@/lib/room-context-path";

/** Zustand `currentRoomId` — 탭 수명 sessionStorage */
export const SESSION_CURRENT_ROOM_ID_KEY = "hau:session:currentRoomId:v1";

export function readCurrentRoomIdFromSessionStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CURRENT_ROOM_ID_KEY);
    if (typeof raw !== "string") return null;
    const t = raw.trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export function writeCurrentRoomIdToSessionStorage(roomId: string): void {
  if (typeof window === "undefined") return;
  const id = roomId.trim();
  if (!id.length) return;
  try {
    sessionStorage.setItem(SESSION_CURRENT_ROOM_ID_KEY, id);
  } catch {
    /* quota / private mode */
  }
}

export function clearCurrentRoomIdSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_CURRENT_ROOM_ID_KEY);
  } catch {
    /* ignore */
  }
}

function trimmedRoomId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const t = id.trim();
  return t.length > 0 ? t : null;
}

/** SSR·hydration 첫 페인트용 — sessionStorage 미사용 */
export function resolveRoomIdFromStoreAndUrl(
  storeRoomId: string | null | undefined,
  urlRoomId?: string | null,
): string | null {
  return trimmedRoomId(urlRoomId) ?? trimmedRoomId(storeRoomId);
}

/** URL → Zustand → sessionStorage (클라이언트 마운트 후에만 sessionStorage 읽기) */
export function resolveCurrentRoomId(
  storeRoomId: string | null | undefined,
  urlRoomId?: string | null,
): string | null {
  return (
    resolveRoomIdFromStoreAndUrl(storeRoomId, urlRoomId) ??
    readCurrentRoomIdFromSessionStorage()
  );
}

/** Zustand + 방 컨텍스트 URL (sessionStorage 미포함, STOMP·SSR 첫 페인트용) */
export function resolveRoomIdFromPathname(
  storeRoomId: string | null | undefined,
  pathname: string,
): string | null {
  const route = parseRoomContextPath(pathname);
  if (route.invalidPackingPath) return null;
  return resolveRoomIdFromStoreAndUrl(storeRoomId, route.roomId);
}
