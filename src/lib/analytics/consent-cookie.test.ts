import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearGoogleAnalyticsCookies,
  parseAnalyticsConsentCookieValue,
  readAnalyticsConsentCookie,
  serializeAnalyticsConsentCookieValue,
  writeAnalyticsConsentCookie,
} from "@/lib/analytics/consent-cookie";

function installCookieJar(initial: Record<string, string> = {}, protocol = "https:") {
  const jar = new Map(Object.entries(initial));
  const writes: string[] = [];

  vi.stubGlobal("document", {});
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
    set: (serialized: string) => {
      writes.push(serialized);
      const [pair = ""] = serialized.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (serialized.includes("Max-Age=0")) jar.delete(name);
      else jar.set(name, value);
    },
  });
  vi.stubGlobal("window", {
    location: { hostname: "app.example.com", protocol },
  });

  return { jar, writes };
}

afterEach(() => vi.unstubAllGlobals());

describe("analytics consent cookie", () => {
  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["v1:granted", "granted"],
    ["v1:denied", "denied"],
    ["v2:granted", null],
    ["unknown", null],
  ])("parses %s", (raw, expected) => {
    expect(parseAnalyticsConsentCookieValue(raw)).toBe(expected);
  });

  it("serializes new choices with the v1 policy version", () => {
    expect(serializeAnalyticsConsentCookieValue("granted")).toBe("v1:granted");
    expect(serializeAnalyticsConsentCookieValue("denied")).toBe("v1:denied");
  });

  it("writes v1 while continuing to read a legacy value", () => {
    const { jar } = installCookieJar({
      uttae_analytics_consent: "granted",
    });

    expect(readAnalyticsConsentCookie()).toBe("granted");
    expect(writeAnalyticsConsentCookie("denied")).toBe(true);
    expect(jar.get("uttae_analytics_consent")).toBe("v1:denied");
  });

  it.each([
    ["https:", "; Secure"],
    ["http:", ""],
  ])("writes a valid cookie attribute list over %s", (protocol, secure) => {
    const { writes } = installCookieJar({}, protocol);

    expect(writeAnalyticsConsentCookie("granted")).toBe(true);
    expect(writes).toEqual([`uttae_analytics_consent=v1:granted; Max-Age=31536000; Path=/; SameSite=Lax${secure}`]);
  });

  it("expires only GA first-party cookies for host and parent domains", () => {
    const { writes } = installCookieJar({
      _ga: "GA1.1.1.1",
      _ga_TEST: "GS1.1.1",
      session: "keep-me",
    });

    clearGoogleAnalyticsCookies();

    expect(writes.some((value) => value.startsWith("_ga=;"))).toBe(true);
    expect(writes.some((value) => value.startsWith("_ga_TEST=;"))).toBe(true);
    expect(writes.some((value) => value.includes("Domain=.example.com"))).toBe(true);
    expect(writes.some((value) => value.startsWith("session=;"))).toBe(false);
  });
});
