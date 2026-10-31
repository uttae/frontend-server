"use client";

import type { ComponentProps } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { HomeTab } from "./HomeTab";
import { ReviewsTab } from "./ReviewsTab";
import { TABS } from "./types";

/**
 * 장소 상세의 홈·리뷰 탭 — 장소 상세 패널·시트와 지도 경로 보기 카드가 함께 쓴다.
 * 숨은 탭 패널은 언마운트된다(Tabs 기본 keepMounted false — 지금처럼 탭을 바꾸면 패널 state·스크롤이 처음부터)
 */
export function PlaceDetailTabs({
  home,
  reviews,
}: Readonly<{
  home: ComponentProps<typeof HomeTab>;
  reviews: ComponentProps<typeof ReviewsTab>;
}>) {
  return (
    <Tabs defaultValue={TABS[0]}>
      <TabsList aria-label="장소 정보">
        {TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="홈">
        <HomeTab {...home} />
      </TabsContent>
      <TabsContent value="리뷰">
        <ReviewsTab {...reviews} />
      </TabsContent>
    </Tabs>
  );
}
