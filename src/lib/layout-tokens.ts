export const width = {
  s1: "400px",
  s2: "720px",
} as const;

export const MAIN_SIDEBAR_RAIL_WIDTH = "68px" as const;

export const CHAT_PANEL_DOCKED_WIDTH = width.s1;

export const MAIN_WORKSPACE_MIN_WIDTH_PX = 384 as const;

export const MAIN_MAP_MIN_WIDTH_PX = 384 as const;

export const MAP_DETAIL_PANEL_WIDTH = "360px" as const;

export const MAP_DETAIL_PANEL_COVER_WIDTH = `calc(0.625rem + ${MAP_DETAIL_PANEL_WIDTH})` as const;

export const PLAN_PLACE_CARD_MIN_SIZE_REM = "6rem" as const;

export const PLAN_PLACE_CARD_TW = {
  article:
    "flex flex-col rounded-[12px] bg-fill-elevate px-3 pt-3 ring-[0.5px] ring-border-subtle",
  contents: "flex min-w-0 items-start gap-3.5 pb-3",
  placeInfo: "flex min-w-0 flex-1 items-center gap-3",
  thumbnail: "relative size-25 shrink-0 overflow-hidden rounded-md bg-fill-strong",
  contentColumn: "flex min-h-25 min-w-0 flex-1 flex-col justify-between gap-2",
  title: "truncate text-body-l-emphasis text-text",
  tag: "inline-flex w-fit max-w-full items-center rounded-full bg-fill-strong px-2 py-0.5 text-label-xs-regular text-text-subtle",
  address: "flex min-w-0 items-start gap-0.5 text-label-m-regular text-text-subtle",
  orderBadgeCompact:
    "absolute left-0 top-0 z-10 box-content size-7 rounded-tl-md rounded-br-md border-b border-r border-white/40 bg-clip-padding text-label-m-emphasis text-text-inverse",
  thumbnailMapMark:
    "pointer-events-none absolute bottom-1 right-1 z-10 flex size-6 items-center justify-center rounded-md bg-black/40 text-icon-inverse ring-[0.5px] ring-inset ring-white/20",
  titleCompact: "text-body-m-emphasis mobile:text-body-s-emphasis font-semibold leading-snug text-gray-900",
  actionBar: "flex min-w-0 flex-wrap items-center justify-between gap-x-2 border-t border-border-subtle pt-0.75 pb-1",
  actionButton:
    "flex min-h-9 shrink-0 cursor-pointer items-center rounded-md px-2.5 py-2 text-body-s-emphasis text-text transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-50 [&>span]:px-1.5",
  actionButtonTrailing: "pr-1",
  actionIcon: "shrink-0 text-icon group-data-filled:text-primary",
  memoActionIcon: "shrink-0 text-icon-subtle group-data-filled:text-primary",
  editorModule:
    "relative flex w-full items-start gap-3 rounded-[12px] bg-fill-strong px-4 py-3 ring-[0.5px] ring-border text-body-s-regular mobile:text-body-xs-regular text-text",
  editorSideLabelWrapper:
    "flex shrink-0 flex-col items-center justify-center gap-1 pt-0.5 text-dark-gray",
  editorSideLabelText:
    "text-body-xs-emphasis font-medium leading-none text-dark-gray",
  editorBody: "flex min-w-0 flex-1 flex-col gap-2",
  editorFooterRow:
    "-mt-1 flex flex-wrap items-start justify-end gap-2 text-body-xs-regular",
  timeFieldLabel: "text-body-xs-emphasis font-medium leading-none text-dark-gray/90",
  timeFieldsRow:
    "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-end gap-2",
  timeField: "flex min-w-0 w-full flex-col gap-1",
  timeInputCompact:
    "h-9 min-w-0 w-full rounded-md border border-gray-200 bg-white px-2 text-body-s-regular shadow-none transition focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/30",
} as const;

export const PLAN_ROUTE_CARD_WIDTH_PX = 620 as const;

export const MAIN_SCROLLBAR_GUTTER_CLASS =
  "[scrollbar-gutter:stable] [scrollbar-color:rgba(0,0,0,0.2)_transparent]" as const;

export const MAIN_PAGE_INLINE_PADDING_CLASS = "pl-5 pr-3 mobile:px-5" as const;

export const MAIN_CARD_INNER_PADDING_X_CLASS = "px-3" as const;
