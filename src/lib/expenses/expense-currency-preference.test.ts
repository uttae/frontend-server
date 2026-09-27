import { afterEach, expect, it, vi } from "vitest";
import { clearUserScopedBrowserStorage } from "@/lib/client-storage";
import {
  clearExpenseCurrencyPreferencesForUser,
  preferredExpenseCurrency,
  rememberExpenseCurrency,
} from "./expense-currency-preference";

const currencies = [
  { currency: "USD", fractionDigits: 2, maximumAmount: "100.00" },
  { currency: "KRW", fractionDigits: 0, maximumAmount: "100" },
];

function storage() {
  const entries = new Map<string, string>();
  return {
    entries,
    get length() { return entries.size; },
    key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { return entries.get(key) ?? null; },
    setItem(key: string, value: string) { entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); },
  };
}

afterEach(() => vi.unstubAllGlobals());

it("keeps preferences across logout and clears only the deleted user's rooms", () => {
  const local = storage();
  vi.stubGlobal("window", { localStorage: local });
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", storage());
  rememberExpenseCurrency(1, "room:a", "USD");
  rememberExpenseCurrency(1, "room:b", "USD");
  rememberExpenseCurrency(2, "room:a", "USD");
  expect(local.entries.size).toBe(3);
  clearUserScopedBrowserStorage();
  expect(preferredExpenseCurrency(1, "room:a", currencies)).toBe("USD");
  clearExpenseCurrencyPreferencesForUser(1);
  expect(local.entries.size).toBe(1);
  expect(preferredExpenseCurrency(1, "room:a", currencies)).toBe("KRW");
  expect(preferredExpenseCurrency(2, "room:a", currencies)).toBe("USD");
});

it("uses the allowed-list fallback and never writes an anonymous key", () => {
  const local = storage();
  vi.stubGlobal("window", { localStorage: local });
  rememberExpenseCurrency(undefined, "room", "USD");
  rememberExpenseCurrency(1, "", "USD");
  expect(local.entries.size).toBe(0);
  rememberExpenseCurrency(1, "room", "KRW");
  expect(preferredExpenseCurrency(1, "room", currencies.slice(0, 1))).toBe("USD");
  expect(preferredExpenseCurrency(undefined, "room", currencies)).toBe("KRW");
});

it("falls back when localStorage throws and during server rendering", () => {
  vi.stubGlobal("window", {
    get localStorage() { throw new Error("unavailable"); },
  });
  expect(preferredExpenseCurrency(1, "room", currencies)).toBe("KRW");
  expect(() => rememberExpenseCurrency(1, "room", "USD")).not.toThrow();
  expect(() => clearExpenseCurrencyPreferencesForUser(1)).not.toThrow();
  vi.unstubAllGlobals();
  expect(preferredExpenseCurrency(1, "room", currencies)).toBe("KRW");
});
