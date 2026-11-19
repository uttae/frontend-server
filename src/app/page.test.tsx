import type { ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & {
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    const { priority, unoptimized, ...imageProps } = props;
    void priority;
    void unoptimized;

    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...imageProps} />;
  },
}));

import RootPage from "@/app/page";

function parseStructuredData(
  html: string,
  id: string,
): Record<string, unknown> {
  const match = html.match(
    new RegExp(`<script[^>]*id="${id}"[^>]*>([^<]*)</script>`),
  );

  expect(match, `missing JSON-LD script #${id}`).not.toBeNull();
  return JSON.parse(match?.[1] ?? "");
}

describe("RootPage", () => {
  it("publishes the organization and software application on the landing page", () => {
    const html = renderToStaticMarkup(<RootPage />);
    const organization = parseStructuredData(html, "uttae-organization");
    const softwareApplication = parseStructuredData(
      html,
      "uttae-software-application",
    );

    expect(organization).toMatchObject({
      "@type": "Organization",
      url: "https://www.uttae.app",
    });
    expect(softwareApplication).toMatchObject({
      "@type": "SoftwareApplication",
      url: "https://www.uttae.app",
    });
    expect(html).not.toContain("https://www.uttae.app/product");
  });
});
