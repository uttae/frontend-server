export const MOBILE_MAP_PATH = "/map";
export const CHAT_PATH = "/chat";

export function isPlanPathname(pathname: string): boolean {
  return pathname === "/plan" || pathname.startsWith("/plan/");
}

export function isMobileMapPathname(pathname: string): boolean {
  return pathname === MOBILE_MAP_PATH;
}

export function isChatPathname(pathname: string): boolean {
  return pathname === CHAT_PATH;
}

export function mobileScheduleHref(pathname: string): string {
  return isPlanPathname(pathname) ? pathname : "/plan";
}

export const MAP_ROUTE_VIEW = "route";

export function buildMapRouteHref(day: number, itemId?: number | null): string {
  const params = new URLSearchParams({ view: MAP_ROUTE_VIEW, day: String(day) });
  if (typeof itemId === "number") params.set("item", String(itemId));
  return `${MOBILE_MAP_PATH}?${params.toString()}`;
}

export function readMapRouteParams(searchParams: { get: (name: string) => string | null }): {
  active: boolean;
  day: number;
  itemId: number | null;
} {
  const positiveInt = (raw: string | null) => {
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  return {
    active: searchParams.get("view") === MAP_ROUTE_VIEW,
    day: positiveInt(searchParams.get("day")) ?? 1,
    itemId: positiveInt(searchParams.get("item")),
  };
}

export function legacyPlanViewPath(view: string | null): string | null {
  if (view === "map") return MOBILE_MAP_PATH;
  if (view === "chat") return CHAT_PATH;
  return null;
}
