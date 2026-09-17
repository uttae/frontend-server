/** Memo versions are independent of schedule order/time revisions. */
export function isMemoVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

type Memo = { memo?: string | null; memoVersion?: number };

export function mergeMemo<T extends Memo>(previous: Memo | undefined, incoming: T): T {
  if (isMemoVersion(previous?.memoVersion) &&
      (!isMemoVersion(incoming.memoVersion) || incoming.memoVersion <= previous.memoVersion)) {
    return { ...incoming, memo: previous.memo, memoVersion: previous.memoVersion };
  }
  return incoming;
}
