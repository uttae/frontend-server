export const width = {
  s1: "400px",
  s2: "720px",
} as const;

/** SideBar·HeaderBar 홈 열 `w-13` (Tailwind spacing 13 = 3.25rem) */
export const MAIN_SIDEBAR_RAIL_WIDTH = "3.25rem" as const;

/** 채팅·LeftSection 최소 폭. maximized `ChatPanel`은 LeftSection 실측(`style.width`)까지 확장 */
export const CHAT_PANEL_DOCKED_WIDTH = width.s1;

/**
 * 플랜 루트 콘텐츠 박스 인라인 폭이 이 값 미만이면 narrow.
 * `width.s1`(채팅·좌측 최소 400px) 과 맞춤.
 */
export const PLAN_CONTAINER_NARROW_MAX_INLINE_PX = 400 as const;

/**
 * `PlanPlaceCard` wide 레이아웃·시간 인라인 배치 공통 브레이크포인트(px).
 * 입력 2개+저장 버튼이 info 컬럼에 들어갈 최소 폭 확보 — 아래 `@min-[…px]/plan` 과 같게 유지.
 */
export const PLAN_PLACE_CARD_LAYOUT_WIDE_MIN_PX = 370 as const;

/** `PlanPlaceCard` 접힌 상태 기준 최소 높이·썸네일 한 변(px) — 사진·본문 열 동기화 */
export const PLAN_PLACE_CARD_MIN_SIZE_REM = "6rem" as const;

/**
 * `PlanPlaceCard` 컨테이너 쿼리 유틸 — 문자열은 **템플릿으로 만들지 말 것**
 * (`@min-[370px]` 처럼 소스에 그대로 적혀야 Tailwind v4가 CSS를 생성함).
 */
export const PLAN_PLACE_CARD_TW = {
  article:
    "relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3.5 rounded-xl border border-gray-border bg-white p-3.5 shadow-sm mobile:gap-x-2.5 mobile:p-2.5",
  thumbnail:
    "relative h-[6rem] w-[6rem] shrink-0 overflow-hidden rounded-lg bg-fill-strong mobile:h-[4.5rem] mobile:w-[4.5rem]",
  contentColumn:
    "flex min-h-[6rem] min-w-0 flex-col justify-start gap-2 mobile:min-h-[4.5rem]",
  titleRow: "flex min-w-0 items-start gap-2.5",
  subtitle: "text-xs leading-snug text-dark-gray/85",
  controlsStack: "flex min-w-0 flex-col gap-0.5",
  orderBadgeCompact:
    "absolute -left-2 -top-2 z-10 h-8 w-8 rounded-lg border-2 border-white text-sm shadow-md",
  titleCompact: "text-base font-semibold leading-snug text-gray-900",
  titleClamp: "line-clamp-2",
  subtitleClamp: "line-clamp-2",
  primaryTypeBadge:
    "shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium leading-none text-dark-gray",
  deleteButtonCompact: "p-1 @min-[370px]/plan:p-1.5",
  deleteIconCompact: "h-5 w-5",
  triggerRow:
    "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1",
  triggerButton:
    "flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-dark-gray/85 transition hover:bg-sky-50 hover:text-sky-600",
  triggerButtonActive: "text-sky-600 font-semibold",
  triggerIcon: "h-4 w-4 shrink-0",
  editorModule:
    "relative flex w-full items-start gap-3 rounded-2xl bg-gray-100/70 px-4 py-3 text-sm text-gray-900",
  editorSideLabelWrapper:
    "flex shrink-0 flex-col items-center justify-center gap-1 pt-0.5 text-dark-gray",
  editorSideLabelText:
    "text-xs font-medium leading-none text-dark-gray",
  editorBody: "flex min-w-0 flex-1 flex-col gap-2",
  editorFooterRow:
    "flex flex-wrap items-center justify-end gap-2 text-xs",
  timeFieldLabel: "text-xs font-medium leading-none text-dark-gray/90",
  timeFieldsRow:
    "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2",
  timeField: "flex min-w-0 w-full flex-col gap-1",
  timeInputCompact:
    "h-9 min-w-0 w-full rounded-md border border-gray-200 bg-white px-2 text-sm shadow-none transition focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/30",
  timeSaveButtonCompact:
    "h-8 shrink-0 rounded-md px-3 text-xs font-medium",
  memoTextarea:
    "min-h-[6rem] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-900 shadow-none transition placeholder:text-dark-gray/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30",
} as const;

/** 플랜 구간(경로) 카드 가로 고정폭(px). 좌측 패널 max(s2) 기준 본문 영역 근사 */
export const PLAN_ROUTE_CARD_WIDTH_PX = 620 as const;

/** (main) 스크롤 컨테이너 — 양쪽 gutter 로 좌우 대칭 (`MainContentScrollArea`, search 제외) */
export const MAIN_SCROLLBAR_GUTTER_CLASS =
  "[scrollbar-gutter:stable_both-edges] [scrollbar-color:rgba(0,0,0,0.2)_transparent]" as const;

/** (main) 본문 콘텐츠 래퍼 좌우 여백 — 스크롤 gutter 와 분리 (`MainContentScrollArea` inner) */
export const MAIN_PAGE_INLINE_PADDING_CLASS = "px-6" as const;

/** bordered 카드·리스트 행 내부 좌우 여백 (`MemberCard`, `PlanDaySection` 등) */
export const MAIN_CARD_INNER_PADDING_X_CLASS = "px-3" as const;
