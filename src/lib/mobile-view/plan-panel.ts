/** `/map`은 모바일 전용 지도 화면(PC는 지도가 레이아웃에 붙어 있음), `/chat`은 PC·모바일 공통 채팅(최대화) 화면 */
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

/** 일정 탭 링크 — `/plan/[roomId]`에 있으면 그 주소를 유지한다 */
export function mobileScheduleHref(pathname: string): string {
  return isPlanPathname(pathname) ? pathname : "/plan";
}

/** `/map` 위 경로 보기 모드 — `?view=route&day=N`(1부터)&item=일정 항목 ID(처음 고를 장소) */
export const MAP_ROUTE_VIEW = "route";

export function buildMapRouteHref(day: number, itemId?: number | null): string {
  const params = new URLSearchParams({ view: MAP_ROUTE_VIEW, day: String(day) });
  if (typeof itemId === "number") params.set("item", String(itemId));
  return `${MOBILE_MAP_PATH}?${params.toString()}`;
}

/** 경로 보기 주소 해석 — 잘못된 `day`는 1일차, 잘못된 `item`은 무시 */
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

/** 예전 `/plan?view=map|chat` 링크(북마크·공유·설치 앱)를 새 경로로 옮긴다 */
export function legacyPlanViewPath(view: string | null): string | null {
  if (view === "map") return MOBILE_MAP_PATH;
  if (view === "chat") return CHAT_PATH;
  return null;
}
