import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next/script", () => ({
  default: ({ src, strategy, ...rest }: { src: string; strategy: string; "data-tokki-key": string }) => (
    <script data-next-script={src} data-strategy={strategy} data-tokki-key={rest["data-tokki-key"]} />
  ),
}));

import { TokkiChatWidget } from "@/components/support/TokkiChatWidget";

function renderAt(pathname: string): string {
  mocks.pathname = pathname;
  return renderToStaticMarkup(<TokkiChatWidget />);
}

describe("TokkiChatWidget", () => {
  it.each(["/", "/home"])("loads the widget script on %s", (pathname) => {
    const html = renderAt(pathname);

    expect(html).toContain('data-next-script="https://chatbot.tokki-ai.com/widget.js"');
    expect(html).toContain('data-strategy="afterInteractive"');
    expect(html).toContain("data-tokki-key=");
  });

  it.each(["/", "/home"])("hides only the launcher while the cookie banner is open on %s", (pathname) => {
    const html = renderAt(pathname);

    expect(html).toContain('body:has([aria-label="쿠키 동의"]) > button[aria-label^="챗봇"]');
    expect(html).not.toContain('iframe[title="톡키 챗봇"]');
  });

  it.each(["/plan/12", "/map", "/chat", "/home/new", "/home/my-info", "/login", "/join/abc"])(
    "does not load and hides an already mounted widget on %s",
    (pathname) => {
      const html = renderAt(pathname);

      expect(html).not.toContain("data-next-script");
      expect(html).toContain('body > button[aria-label^="챗봇"]');
      expect(html).toContain('body > iframe[title="톡키 챗봇"]');
      expect(html).toContain("visibility: hidden");
    },
  );
});
