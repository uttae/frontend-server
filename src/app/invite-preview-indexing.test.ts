import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("invite preview indexing contract", () => {
  it("marks the static preview document noindex, nofollow", () => {
    const document = readFileSync(resolve(process.cwd(), "public/invite-preview.html"), "utf8");
    const robotsMeta = '<meta name="robots" content="noindex, nofollow" />';
    const head = document.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";

    expect(head).toContain(robotsMeta);
    expect(document.match(/<meta name="robots"[^>]*>/g)).toEqual([robotsMeta]);
  });

  it("serves the static preview with an exact X-Robots-Tag header", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: "/invite-preview.html",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ]);
  });
});
