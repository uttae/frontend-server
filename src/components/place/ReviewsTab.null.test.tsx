// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ReviewsTab } from "./ReviewsTab";
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("nullable review author and rating render without invented author or stars", async () => {
  const host = document.createElement("div"); const root = createRoot(host);
  try {
    await act(async () => root.render(<ReviewsTab rating={null} reviews={[{ rating: null, text: null, authorDisplayName: null, publishTime: null, relativePublishTimeDescription: null }]} />));
    expect(host.textContent).not.toContain("null");
    expect(host.querySelector('[aria-label*="별점"]')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});
