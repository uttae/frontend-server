/** 툴바 하단 ~ 패널 상단 간격(px) */
export const MAP_DETAIL_PANEL_BELOW_TOOLBAR_GAP_PX = 12;

/**
 * 패널 `top` 최솟값·초기값(px) — 필터 한 줄 아래 자리(`MapDiscoverToolbar`의 `top-3` 12 + `min-h-12` 48 + 간격).
 * 필터를 숨겨도(웹 동선보기) 이 자리를 지키고, 필터가 두 줄로 늘어날 때만 그 아래로 내려간다
 */
export const MAP_DETAIL_PANEL_MIN_TOP_PX = 12 + 48 + MAP_DETAIL_PANEL_BELOW_TOOLBAR_GAP_PX;

/** PlaceDetailPanel(`z-20`) 위 — 평점 드롭다운 열림 시 툴바 스택 */
export const MAP_TOOLBAR_ELEVATED_Z_CLASS = "z-[25]" as const;

/** 지도 툴바 기본 스택 */
export const MAP_TOOLBAR_Z_CLASS = "z-[15]" as const;

/** 툴바 elevated 스택 안 드롭다운 메뉴 */
export const MAP_FILTER_DROPDOWN_MENU_Z_CLASS = "z-[30]" as const;
