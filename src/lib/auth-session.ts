const RECONCILE_SKIP_PATH_PREFIXES = ["/auth/callback", "/login"] as const;

export function shouldSkipReconcileClientSession(pathname: string): boolean {
  return RECONCILE_SKIP_PATH_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldReconcileClientSessionTransition(
  previousPathname: string | null,
  pathname: string,
): boolean {
  if (shouldSkipReconcileClientSession(pathname)) return false;
  return (
    previousPathname === null ||
    shouldSkipReconcileClientSession(previousPathname)
  );
}

type ClientSessionReconciliationTransition = {
  markSessionPending: () => void;
  pathname: string;
  previousPathname: string | null;
  reconcile: () => void;
};

export function beginClientSessionReconciliationTransition({
  markSessionPending,
  pathname,
  previousPathname,
  reconcile,
}: ClientSessionReconciliationTransition): string {
  if (
    shouldReconcileClientSessionTransition(previousPathname, pathname)
  ) {
    markSessionPending();
    reconcile();
  }
  return pathname;
}

/** `proxy.ts` 보호 경로와 동일 — reconcile 실패 시 로그인 리다이렉트 판단용 */
export function isProtectedAppPath(pathname: string): boolean {
  const prefixes = [
    "/home",
    "/plan",
    "/packing",
    "/cost",
    "/bookmark",
    "/search",
    "/member-settings",
    "/room-settings",
    "/settings",
    "/contact",
    "/waiting",
  ];
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
