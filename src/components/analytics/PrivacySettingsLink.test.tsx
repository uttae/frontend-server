import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PrivacySettingsLink } from "@/components/analytics/PrivacySettingsLink";

describe("PrivacySettingsLink", () => {
  it("renders an addressable privacy settings link", () => {
    const html = renderToStaticMarkup(<PrivacySettingsLink className="menu-link">개인정보 설정</PrivacySettingsLink>);

    expect(html).toContain('href="/privacy-settings"');
    expect(html).toContain('class="menu-link"');
    expect(html).toContain("개인정보 설정");
  });
});
