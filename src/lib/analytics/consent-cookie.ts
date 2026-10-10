export const ANALYTICS_CONSENT_COOKIE_NAME = "uttae_analytics_consent";
export const ANALYTICS_CONSENT_COOKIE_VERSION = "v1";

const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AnalyticsConsentValue = "granted" | "denied";
export type AnalyticsConsent = AnalyticsConsentValue | null;

export function parseAnalyticsConsentCookieValue(
  raw: string | undefined,
): AnalyticsConsent {
  if (raw === "granted" || raw === "v1:granted") return "granted";
  if (raw === "denied" || raw === "v1:denied") return "denied";
  return null;
}

export function serializeAnalyticsConsentCookieValue(
  value: AnalyticsConsentValue,
): string {
  return `${ANALYTICS_CONSENT_COOKIE_VERSION}:${value}`;
}

export function readAnalyticsConsentCookie(): AnalyticsConsent {
  if (typeof document === "undefined") return null;

  const prefix = `${ANALYTICS_CONSENT_COOKIE_NAME}=`;
  for (const cookie of document.cookie.split(";")) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(prefix)) {
      return parseAnalyticsConsentCookieValue(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function writeAnalyticsConsentCookie(
  value: AnalyticsConsentValue,
): boolean {
  if (typeof document === "undefined") return false;

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "Secure"
      : "";
  document.cookie = [
    `${ANALYTICS_CONSENT_COOKIE_NAME}=${serializeAnalyticsConsentCookieValue(value)}`,
    `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");

  return readAnalyticsConsentCookie() === value;
}

function googleAnalyticsCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0] ?? "")
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
}

function cookieDomainCandidates(hostname: string): string[] {
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2 || /^\d+(\.\d+){3}$/.test(hostname)) return [];
  return parts
    .slice(0, -1)
    .map((_, index) => `.${parts.slice(index).join(".")}`);
}

export function clearGoogleAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  clearAnalyticsCookies(googleAnalyticsCookieNames(document.cookie));
}

/** Delete only the named cookies at the domains our browser SDKs may use. */
export function clearAnalyticsCookies(names: readonly string[]): void {
  if (typeof document === "undefined") return;

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const domains = cookieDomainCandidates(hostname);

  for (const name of names) {
    const base = `${name}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    document.cookie = base;
    for (const domain of domains) {
      document.cookie = `${base}; Domain=${domain}`;
    }
  }
}
