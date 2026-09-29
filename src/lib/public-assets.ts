/** `public/` 정적 자산 URL — 폴더·파일명 변경 시 이 모듈만 수정 */

export const brandAssets = {
  logo: "/brand/textlogo.svg",
  shareImage: "/brand/og_image.png",
} as const;

export const faviconAssets = {
  icon16: "/favicon/favicon-16x16.png",
  icon32: "/favicon/favicon-32x32.png",
  ico: "/favicon/favicon.ico",
  appleTouchIcon: "/favicon/apple-touch-icon.png",
  manifest: "/favicon/site.webmanifest",
} as const;

export const sidebarIcons = {
  cost: "/icons/sidebar/calculator.svg",
  chat: "/icons/sidebar/chat.svg",
  search: "/icons/sidebar/search.svg",
  plan: "/icons/sidebar/calendar-days.svg",
  bookmark: "/icons/sidebar/bookmark.svg",
  memberSettings: "/icons/sidebar/user-cog.svg",
  roomSettings: "/icons/sidebar/settings.svg",
  bug: "/icons/sidebar/bug.svg",
} as const;

/** Figma 1049:2992 exports; desktop wireframe, separate from mobile assets. */
export const sidebarWireframeIcons = {
  plan: "/icons/sidebar/figma/calendar.svg",
  search: "/icons/sidebar/figma/search.svg",
  bookmark: "/icons/sidebar/figma/bookmark.svg",
  packing: "/icons/sidebar/figma/packing.svg",
  chat: "/icons/sidebar/figma/chat.svg",
  memberSettings: "/icons/sidebar/figma/members.svg",
  feedback: "/icons/sidebar/figma/feedback.svg",
  bug: "/icons/sidebar/figma/bug.svg",
} as const;

export const chatAssets = {
  woori: "/icons/woori.svg",
} as const;

/** Figma 준비물 GUI (4162:4429)의 원본 아이콘. */
export const packingIcons = {
  plusWhite: "/icons/packing/plus-white.svg",
  plus: "/icons/packing/plus.svg",
  checkbox: "/icons/packing/checkbox.svg",
  checkboxChecked: "/icons/packing/checkbox-checked.svg",
  menu: "/icons/packing/menu.svg",
  edit: "/icons/packing/edit.svg",
  delete: "/icons/packing/delete.svg",
  collapse: "/icons/packing/collapse.svg",
  menuPlus: "/icons/packing/menu-plus.svg",
  menuEdit: "/icons/packing/menu-edit.svg",
  menuDelete: "/icons/packing/menu-delete.svg",
} as const;

export const landingAssetDir = "/landing" as const;
