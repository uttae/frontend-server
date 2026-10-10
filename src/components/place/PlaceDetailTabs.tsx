"use client";

import { useState, type ComponentProps } from "react";

import { HomeTab } from "./HomeTab";
import { ReviewsTab } from "./ReviewsTab";
import { TABS, type Tab } from "./types";

/** 장소 상세의 홈·리뷰 탭 — 장소 상세 패널·시트와 지도 경로 보기 카드가 함께 쓴다 */
export function PlaceDetailTabs({
  home,
  reviews,
}: Readonly<{
  home: ComponentProps<typeof HomeTab>;
  reviews: ComponentProps<typeof ReviewsTab>;
}>) {
  const [activeTab, setActiveTab] = useState<Tab>("홈");

  return (
    <>
      {/* Tab navigation */}
      <div className="flex shrink-0 border-b border-gray-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-label-s-regular mobile:text-label-xs-regular font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-dark-gray hover:text-[#364153]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "홈" && <HomeTab {...home} />}
      {activeTab === "리뷰" && <ReviewsTab {...reviews} />}
    </>
  );
}
