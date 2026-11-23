import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { SearchResultCard } from "./SearchResultCard";

import { vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-client";
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-maps-key";
});

describe("SearchResultCard", () => {
  it("썸네일을 숨기면 장소 사진 쿼리를 생성하지 않는다", () => {
    const queryClient = new QueryClient();

    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(SearchResultCard, {
          name: "후글렌 도쿄 시부야",
          category: "카페",
          rating: 4.3,
          googlePlaceId: "ChIJ-test-place",
          showThumbnail: false,
        }),
      ),
    );

    expect(html).toContain("후글렌 도쿄 시부야");
    expect(queryClient.getQueryCache().findAll({ queryKey: ["places", "photoUrl"] })).toHaveLength(0);
  });
});
