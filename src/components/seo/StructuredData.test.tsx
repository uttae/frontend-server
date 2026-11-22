import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StructuredData } from "@/components/seo/StructuredData";

describe("StructuredData", () => {
  it("renders JSON-LD and escapes closing script input", () => {
    const html = renderToStaticMarkup(
      <StructuredData id="test-json-ld" data={{ name: "</script><script>alert(1)</script>" }} />,
    );

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('id="test-json-ld"');
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("</script><script>alert");
  });
});
