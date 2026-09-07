/** `public/` 정적 자산 URL — 폴더·파일명 변경 시 이 모듈만 수정 */

export const brandAssets = {
  logo: "/brand/textlogo.svg",
  shareImage: "/brand/App_Icon.png",
} as const;

export const faviconAssets = {
  icon16: "/favicon/favicon-16x16.png",
  icon32: "/favicon/favicon-32x32.png",
  ico: "/favicon/favicon.ico",
  appleTouchIcon: "/favicon/apple-touch-icon.png",
  manifest: "/favicon/site.webmanifest",
} as const;

export const sidebarIcons = {
  chat: "/icons/sidebar/chat.svg",
  search: "/icons/sidebar/search.svg",
  plan: "/icons/sidebar/calendar-days.svg",
  bookmark: "/icons/sidebar/bookmark.svg",
  memberSettings: "/icons/sidebar/user-cog.svg",
  roomSettings: "/icons/sidebar/settings.svg",
} as const;

export const chatAssets = {
  woori: "/icons/woori.svg",
} as const;

export const landingAssetDir = "/landing" as const;
