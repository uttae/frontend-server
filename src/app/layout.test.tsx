import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/root-providers", () => ({
  AppRootProviders: ({ children }: { children: ReactNode }) => children,
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders page content without injecting scripts in the document head", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <main>content</main>
      </RootLayout>,
    );
    const headHtml = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";

    expect(headHtml).not.toContain("<script");
    expect(html).toContain('<html lang="ko"');
    expect(html).toContain("<main>content</main>");
  });
});
