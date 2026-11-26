import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReviewsTab } from "./ReviewsTab";

const reviewsUri = "https://www.google.com/maps/place/?q=place_id:ChIJ-test&action=reviews";

function renderReviewsTab(props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(ReviewsTab as ComponentType<Record<string, unknown>>, props));
}

describe("ReviewsTab", () => {
  it("Google Maps 리뷰 전체보기 링크를 새 탭으로 연다", () => {
    const html = renderReviewsTab({
      rating: 4.7,
      userRatingCount: 128,
      reviewsUri,
      reviews: [
        {
          rating: 5,
          text: "좋아요",
          authorDisplayName: "홍길동",
          publishTime: "2026-07-11T00:00:00Z",
          relativePublishTimeDescription: "오늘",
        },
      ],
    });

    expect(html).toContain(`href="${reviewsUri.replaceAll("&", "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("리뷰 전체보기");
  });

  it("일부 리뷰의 별점 분포 대신 전체 평점 요약을 표시한다", () => {
    const html = renderReviewsTab({
      rating: 4.7,
      userRatingCount: 128,
      reviewsUri,
      reviews: [
        {
          rating: 5,
          text: "좋아요",
          authorDisplayName: "홍길동",
          publishTime: "2026-07-11T00:00:00Z",
          relativePublishTimeDescription: "오늘",
        },
      ],
    });

    expect(html).toContain("Google 평점");
    expect(html).toContain("전체 리뷰 128개");
    expect(html).toContain("Google에서 제공한 일부 리뷰만 표시돼요.");
    expect(html).not.toContain('style="width:');
  });

  it("수집된 리뷰가 없어도 리뷰 전체보기 링크를 표시한다", () => {
    const html = renderReviewsTab({
      rating: 4.7,
      reviewsUri,
      reviews: [],
    });

    expect(html).toContain("등록된 리뷰가 없어요");
    expect(html).toContain("리뷰 전체보기");
  });

  it("리뷰 URL이 없으면 리뷰 전체보기 링크를 표시하지 않는다", () => {
    const html = renderReviewsTab({
      rating: 4.7,
      reviewsUri: null,
      reviews: [],
    });

    expect(html).not.toContain("리뷰 전체보기");
  });
});
