"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { FeedbackBanner } from "./FeedbackBanner";

export type HomeBanner = {
  id: string;
  href: string;
  label: string;
  content: ReactNode;
};

export const HOME_BANNERS: readonly HomeBanner[] = [
  {
    id: "feedback-event",
    href: "https://forms.gle/giYqRzrhCYF9Hz1M9",
    label: "피드백 이벤트: 피드백 남기고 싸이버거 받아 가세요! 이벤트 기간 ~10/25일, 참여하기 (새 창)",
    content: <FeedbackBanner />,
  },
];

export function HomeBannerCarousel({ banners }: { banners: readonly HomeBanner[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (banners.length === 0) return null;

  const currentIndex = Math.min(activeIndex, banners.length - 1);
  const banner = banners[currentIndex];

  return (
    <section aria-label="이벤트 배너" className="pt-8 pb-8 mobile:pt-6 mobile:pb-6">
      <a
        key={banner.id}
        href={banner.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={banner.label}
        className="block rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {banner.content}
      </a>

      {banners.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm text-text-subtle" role="group" aria-label="배너 탐색">
          <button
            type="button"
            aria-label="이전 배너"
            onClick={() => setActiveIndex((index) => (index - 1 + banners.length) % banners.length)}
            className="flex size-8 items-center justify-center rounded-full hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <span aria-live="polite">{currentIndex + 1} / {banners.length}</span>
          <button
            type="button"
            aria-label="다음 배너"
            onClick={() => setActiveIndex((index) => (index + 1) % banners.length)}
            className="flex size-8 items-center justify-center rounded-full hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
