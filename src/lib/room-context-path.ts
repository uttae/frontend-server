import { roomIdFromPlanPathname } from "./plan-room-path";

export function isPackingPath(pathname: string): boolean {
  return pathname === "/packing" || pathname.startsWith("/packing/");
}

/** An explicit invalid packing URL must never fall back to another room. */
export function parseRoomContextPath(pathname: string): {
  roomId: string | null;
  invalidPackingPath: boolean;
} {
  if (!isPackingPath(pathname)) {
    return { roomId: roomIdFromPlanPathname(pathname), invalidPackingPath: false };
  }
  const match = /^\/packing\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname);
  return { roomId: match?.[1].toLowerCase() ?? null, invalidPackingPath: !match };
}
