const MAIN_MOBILE_BLOCKED_PREFIXES = [
  "/settings",
  "/contact",
] as const;

const MOBILE_READ_ONLY_NOTICE_PREFIXES = [
  "/home",
  "/plan",
  "/bookmark",
  "/member-settings",
  "/room-settings",
] as const;

export function isMobileReadOnlyNoticeRoute(pathname: string): boolean {
  return MOBILE_READ_ONLY_NOTICE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMainRouteBlockedOnMobile(pathname: string): boolean {
  return MAIN_MOBILE_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
