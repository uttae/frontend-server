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

/** 예전 `/plan?view=map|chat` 링크(북마크·공유·설치 앱)를 새 경로로 옮긴다 */
export function legacyPlanViewPath(view: string | null): string | null {
  if (view === "map") return MOBILE_MAP_PATH;
  if (view === "chat") return CHAT_PATH;
  return null;
}
