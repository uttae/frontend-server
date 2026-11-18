export const width = {
  s1: "400px",
  s2: "720px",
} as const;

/** Figma 사이드바 1049:2992 · HeaderBar 홈 열 공통 폭 */
export const MAIN_SIDEBAR_RAIL_WIDTH = "68px" as const;

/** 채팅 패널을 붙여 둘 때 폭(사이드바 레일 제외) — 최소화 창 크기 계산이 따른다 */
export const CHAT_PANEL_DOCKED_WIDTH = width.s1;

/**
 * 데스크톱 최소 폭 768(Figma `Web/일정/768`)을 좌측 영역과 지도가 384씩 나눈다.
 * 좌측 영역 값은 사이드바 레일·오른쪽 테두리를 포함한다.
 * 화면이 768보다 좁아도 모바일로 바꾸지 않고 레이아웃 안에서 가로 스크롤한다.
 */
export const MAIN_WORKSPACE_MIN_WIDTH_PX = 384 as const;

/** 데스크톱 지도 최소 폭 — Figma `Web/일정/768`의 Map 폭(좌측 영역 384와 합쳐 768) */
export const MAIN_MAP_MIN_WIDTH_PX = 384 as const;

/**
 * 데스크톱 장소 상세 패널 폭. 지도 폭과 관계없이 360이고(지도 최소 384 − 왼쪽 여백 10 안에 들어간다),
 * 지도가 좁아지면 오른쪽 아래 확대·축소(+/−)·북마크 버튼이 자리를 따로 차지하지 않고 패널(z-20) 뒤로 들어간다
 */
export const MAP_DETAIL_PANEL_WIDTH = "360px" as const;

/** 상세 패널이 가리는 지도 왼쪽 폭 — `MapWithDetailPanel`의 `left-2.5` + 패널 폭. 지도와 같은 폭 칸 안에서만 쓴다 */
export const MAP_DETAIL_PANEL_COVER_WIDTH = `calc(0.625rem + ${MAP_DETAIL_PANEL_WIDTH})` as const;

/** `PlanPlaceCard` 접힌 상태 기준 최소 높이·썸네일 한 변(px) — 사진·본문 열 동기화 */
export const PLAN_PLACE_CARD_MIN_SIZE_REM = "6rem" as const;

/**
 * `PlanPlaceCard` 클래스 묶음 — 문자열은 **템플릿으로 만들지 말 것**
 * (소스에 그대로 적혀야 Tailwind v4가 CSS를 생성함).
 */
export const PLAN_PLACE_CARD_TW = {
  /** Figma Card/Place/Web — 테두리는 Figma의 바깥 0.5px stroke라 크기에 들어가지 않는 ring으로 그린다 */
  article:
    "flex flex-col rounded-[12px] bg-fill-elevate px-3 pt-3 ring-[0.5px] ring-border-subtle",
  /** 사진·글과 오른쪽 위 메뉴 줄 */
  contents: "flex min-w-0 items-start gap-3.5 pb-3",
  placeInfo: "flex min-w-0 flex-1 items-center gap-3",
  thumbnail: "relative size-25 shrink-0 overflow-hidden rounded-md bg-fill-strong",
  /** 장소 이름·태그는 위, 주소는 사진 아래 끝에 맞춘다 */
  contentColumn: "flex min-h-25 min-w-0 flex-1 flex-col justify-between gap-2",
  title: "truncate text-body-l-emphasis text-text",
  /** Figma Tags 프레임 — 디자인 시스템 Badge(둥글기 4)가 아니라 알약 모양 */
  tag: "inline-flex w-fit max-w-full items-center rounded-full bg-fill-strong px-2 py-0.5 text-label-xs-regular text-text-subtle",
  /** Figma Address — 좁은 카드에서 두 줄까지 줄바꿈한다. 아이콘은 첫 줄 높이(20) 칸 가운데 */
  address: "flex min-w-0 items-start gap-0.5 text-label-m-regular text-text-subtle",
  /**
   * 사진 왼쪽 위에 붙는 번호(Figma Image 6663:5322 Number) — 둥글기 `var(--radius-md) 0`, 오른쪽·아래 흰 40% 1px.
   * 바탕은 그 일차의 지도 경로색(1일차는 Figma primary). 테두리는 Figma의 바깥 stroke라 `box-content`로 28 밖에 둔다
   */
  orderBadgeCompact:
    "absolute left-0 top-0 z-10 box-content size-7 rounded-tl-md rounded-br-md border-b border-r border-white/40 text-label-m-emphasis text-text-inverse",
  /** 사진 오른쪽 아래 지도 표시(Figma Location). 0.5px 안쪽 stroke는 border로 그리면 크롬이 1px로 올려 그려 inset ring으로 둔다 */
  thumbnailMapMark:
    "pointer-events-none absolute bottom-1 right-1 z-10 flex size-6 items-center justify-center rounded-md bg-black/40 text-icon-inverse ring-[0.5px] ring-inset ring-white/20",
  titleCompact: "text-body-m-emphasis mobile:text-body-s-emphasis font-semibold leading-snug text-gray-900",
  /**
   * 카드 아래 시간·비용(왼쪽)과 메모(오른쪽) 버튼 줄. Figma 구분선은 위 줄(Contents)의 아래 선인데,
   * 도구 줄이 없는 카드(저장 전 장소)에 선만 남지 않게 이 줄의 위 선으로 둔다.
   * Figma Tools는 wrap이라 좁으면 메모가 다음 줄로, 값이 길면 시간·비용도 한 줄씩 내려간다.
   * Figma 선은 크기에 들어가지 않는 안쪽 stroke라 위 여백 4에서 선 1을 뺀다(한 줄 44·두 줄 80 유지)
   */
  actionBar: "flex min-w-0 flex-wrap items-center justify-between gap-x-2 border-t border-border-subtle pt-0.75 pb-1",
  /** Figma Button Neutral Weak sm — 인스턴스에 바탕이 없다. 좌우 여백 10, 아이콘 16, 라벨(`span`) 좌우 여백 6. 누를 수 있어 hover 바탕은 둔다 */
  actionButton:
    "flex min-h-9 shrink-0 cursor-pointer items-center rounded-md px-2.5 py-2 text-body-s-emphasis text-text transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-50 [&>span]:px-1.5",
  /** 메모 버튼만 Button Base 오른쪽 여백이 4다(디자인) */
  actionButtonTrailing: "pr-1",
  /** 값이 있으면 버튼의 `data-filled`로 파랑 — 비용 버튼(`ExpenseEntryButton`)과 같은 방식 */
  actionIcon: "shrink-0 text-icon group-data-filled:text-primary",
  /** 메모만 비어 있을 때 icon/subtle(디자인) */
  memoActionIcon: "shrink-0 text-icon-subtle group-data-filled:text-primary",
  /** 메모 편집 칸 — Figma에 편집 상태가 없어 회색 일차 바탕 위에서 보이도록 읽기 메모 칸(Memo)과 같은 바탕·테두리를 쓴다 */
  editorModule:
    "relative flex w-full items-start gap-3 rounded-[12px] bg-fill-strong px-4 py-3 ring-[0.5px] ring-border text-body-s-regular mobile:text-body-xs-regular text-text",
  editorSideLabelWrapper:
    "flex shrink-0 flex-col items-center justify-center gap-1 pt-0.5 text-dark-gray",
  editorSideLabelText:
    "text-body-xs-emphasis font-medium leading-none text-dark-gray",
  editorBody: "flex min-w-0 flex-1 flex-col gap-2",
  /** 글자 수(왼쪽)는 입력 칸 바로 아래 붙고, 취소·저장(오른쪽)은 같은 줄 — editorBody 간격 8에서 4만 띄운다 */
  editorFooterRow:
    "-mt-1 flex flex-wrap items-start justify-end gap-2 text-body-xs-regular",
  timeFieldLabel: "text-body-xs-emphasis font-medium leading-none text-dark-gray/90",
  timeFieldsRow:
    "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2",
  timeField: "flex min-w-0 w-full flex-col gap-1",
  timeInputCompact:
    "h-9 min-w-0 w-full rounded-md border border-gray-200 bg-white px-2 text-body-s-regular shadow-none transition focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/30",
} as const;

/** 플랜 구간(경로) 카드 가로 고정폭(px). 좌측 패널 max(s2) 기준 본문 영역 근사 */
export const PLAN_ROUTE_CARD_WIDTH_PX = 620 as const;

/** (main) 스크롤 컨테이너 — 스크롤바 자리는 오른쪽에만 둔다. 왼쪽에도 두면 본문 왼쪽 여백이 20보다 넓어진다 (`MainContentScrollArea`, search 제외) */
export const MAIN_SCROLLBAR_GUTTER_CLASS =
  "[scrollbar-gutter:stable] [scrollbar-color:rgba(0,0,0,0.2)_transparent]" as const;

/**
 * (main) 본문 콘텐츠 래퍼 좌우 여백 — 스크롤 gutter 와 분리 (`MainContentScrollArea` inner).
 * PC는 Figma 페이지 컨테이너(가계부 6576:26325 등) 왼쪽 20 · 오른쪽 12, 모바일은 좌우 20(Mobile/북마크/393 6663:5802).
 */
export const MAIN_PAGE_INLINE_PADDING_CLASS = "pl-5 pr-3 mobile:px-5" as const;

/** bordered 카드·리스트 행 내부 좌우 여백 (`MemberCard`, `PlanDaySection` 등) */
export const MAIN_CARD_INNER_PADDING_X_CLASS = "px-3" as const;
