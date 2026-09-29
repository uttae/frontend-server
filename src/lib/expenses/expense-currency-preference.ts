import type { ExpenseCurrency } from "@/lib/api/rooms/expenses";

const PREFIX = "hau:expense-add-currency:v1:";

function userPrefix(userId: number | undefined): string | null {
  return typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0
    ? `${PREFIX}${userId}:`
    : null;
}

function preferenceKey(userId: number | undefined, roomId: string): string | null {
  const prefix = userPrefix(userId);
  const room = roomId.trim();
  return prefix && room ? `${prefix}${encodeURIComponent(room)}` : null;
}

export function preferredExpenseCurrency(
  userId: number | undefined,
  roomId: string,
  currencies: readonly ExpenseCurrency[],
): string {
  const fallback = currencies.find((item) => item.currency === "KRW")?.currency
    ?? currencies[0]?.currency ?? "";
  const key = preferenceKey(userId, roomId);
  if (!key || typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return currencies.find((item) => item.currency === stored)?.currency ?? fallback;
  } catch {
    return fallback;
  }
}

export function rememberExpenseCurrency(
  userId: number | undefined,
  roomId: string,
  currency: string,
): void {
  const key = preferenceKey(userId, roomId);
  if (!key || !currency || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, currency);
  } catch {
    // Private browsing and storage quota errors cannot block a saved expense.
  }
}

export function clearExpenseCurrencyPreferencesForUser(userId: number | undefined): void {
  const prefix = userPrefix(userId);
  if (!prefix || typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) {
      try { storage.removeItem(key); } catch { /* unavailable */ }
    }
  } catch {
    // Account deletion still completes when browser storage is unavailable.
  }
}
