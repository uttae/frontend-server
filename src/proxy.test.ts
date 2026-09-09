import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionWithOptionalRefresh } = vi.hoisted(() => ({
  verifySessionWithOptionalRefresh: vi.fn(),
}));

vi.mock("@/lib/auth-server", () => ({
  verifySessionWithOptionalRefresh,
}));

import { proxy } from "@/proxy";

function inviteRequest(userAgent: string): NextRequest {
  return new NextRequest("https://www.uttae.app/join/test-invite", {
    headers: { "user-agent": userAgent },
  });
}

function appRequest(pathname: string): NextRequest {
  return new NextRequest(`https://www.uttae.app${pathname}`);
}

describe("invite preview proxy indexing contract", () => {
  beforeEach(() => {
    verifySessionWithOptionalRefresh.mockReset();
    verifySessionWithOptionalRefresh.mockResolvedValue({
      ok: false,
      setCookies: [],
    });
  });

  it.each([
    "Discordbot/2.0",
    "KAKAOTALK-SCRAP/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "LinkedInBot/1.0",
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.23",
    "Line/13.0",
  ])("rewrites supported social preview UA %s with noindex headers", async (ua) => {
    const response = await proxy(inviteRequest(ua));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://www.uttae.app/invite-preview.html",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(verifySessionWithOptionalRefresh).not.toHaveBeenCalled();
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "Mozilla/5.0 (compatible; ExampleCrawler/1.0)",
  ])("does not turn search crawler UA %s into a preview response", async (ua) => {
    const response = await proxy(inviteRequest(ua));

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(verifySessionWithOptionalRefresh).toHaveBeenCalledOnce();
  });
});

describe("protected route redirect indexing contract", () => {
  beforeEach(() => {
    verifySessionWithOptionalRefresh.mockReset();
    verifySessionWithOptionalRefresh.mockResolvedValue({
      ok: false,
      setCookies: [],
    });
  });

  it.each([
    "/home",
    "/home/new",
    "/plan/room-1",
    "/bookmark/folder-1",
    "/search",
    "/member-settings",
    "/room-settings",
    "/contact",
    "/settings",
    "/waiting",
  ])("marks the unauthenticated %s redirect noindex, nofollow", async (path) => {
    const response = await proxy(appRequest(path));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.uttae.app/login",
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("public entry route indexing contract", () => {
  beforeEach(() => {
    verifySessionWithOptionalRefresh.mockReset();
  });

  it.each(["/login", "/"])(
    "marks the authenticated %s redirect noindex, nofollow",
    async (path) => {
      verifySessionWithOptionalRefresh.mockResolvedValue({
        ok: true,
        setCookies: ["session=refreshed; Path=/; HttpOnly"],
      });

      const response = await proxy(appRequest(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://www.uttae.app/home",
      );
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("set-cookie")).toBe(
        "session=refreshed; Path=/; HttpOnly",
      );
    },
  );

  it("keeps the anonymous public root indexable", async () => {
    verifySessionWithOptionalRefresh.mockResolvedValue({
      ok: false,
      setCookies: [],
    });

    const response = await proxy(appRequest("/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

it("keeps the explicit cookie settings landing entry accessible to authenticated users", async () => {
  verifySessionWithOptionalRefresh.mockResolvedValue({ ok: true, setCookies: ["session=refreshed; Path=/; HttpOnly"] });
  const response = await proxy(appRequest("/?cookie-settings=open"));
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("set-cookie")).toBe("session=refreshed; Path=/; HttpOnly");
});
