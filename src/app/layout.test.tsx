import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/root-providers", () => ({
  AppRootProviders: ({ children }: { children: ReactNode }) => children,
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders the Travelpayouts ownership loader in the document head", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>content</main>
      </RootLayout>,
    );
    const headHtml = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";

    expect(headHtml).toContain("<script");
    expect(headHtml).toContain('nowprocket=""');
    expect(headHtml).toContain('data-noptimize="1"');
    expect(headHtml).toContain('data-cfasync="false"');
    expect(headHtml).toContain('data-wpfc-render="false"');
    expect(headHtml).toContain('seraph-accel-crit="1"');
    expect(headHtml).toContain('data-no-defer="1"');
    expect(headHtml).toContain("script.async = 1;");
    expect(headHtml).toContain(
      "script.src = 'https://emrldtp.com/NTU0ODU1.js?t=554855';",
    );
    expect(headHtml).toContain("document.head.appendChild(script);");
  });
});
