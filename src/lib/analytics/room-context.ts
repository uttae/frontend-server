import { parseRoomContextPath } from "@/lib/room-context-path";

const roomRootPaths = new Set([
  "plan", "map", "chat", "bookmark", "search", "cost", "settings", "room-settings", "member-settings",
]);
const roomDetailPaths = new Set(["plan", "packing", "bookmark"]);

/** Only routes actually rendered under MainRoomGate may use the selected room. */
export function isAnalyticsRoomPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0];
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  const parts = path.slice(0, end).split("/");
  if (parts[0] !== "") return false;
  if (parts.length === 2) return roomRootPaths.has(parts[1]);
  return parts.length === 3 && roomDetailPaths.has(parts[1]) && parts[2].length > 0;
}

export function resolveAnalyticsRoomId({
  pathname,
  currentRoomId,
  sessionReady,
  userId,
}: {
  pathname: string;
  currentRoomId: string | null | undefined;
  sessionReady: boolean;
  userId: number | null | undefined;
}): string | undefined {
  if (!sessionReady || !userId) return;
  return resolveSelectedAnalyticsRoomId({ pathname, currentRoomId });
}

/** Route/store agreement only; this does not authorize grouping an anonymous event. */
export function resolveSelectedAnalyticsRoomId({
  pathname,
  currentRoomId,
}: {
  pathname: string;
  currentRoomId: string | null | undefined;
}): string | undefined {
  if (!isAnalyticsRoomPath(pathname)) return;
  const selectedRoomId = currentRoomId?.trim();
  if (!selectedRoomId) return;
  try {
    const route = parseRoomContextPath(pathname.split(/[?#]/, 1)[0]);
    if (route.invalidPackingPath) return;
    if (route.roomId && route.roomId !== selectedRoomId) return;
    return selectedRoomId;
  } catch {
    // Malformed URL encoding cannot establish a room context.
    return;
  }
}
