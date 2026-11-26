"use client";

import type { ComponentProps } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { HomeTab } from "./HomeTab";
import { ReviewsTab } from "./ReviewsTab";
import { TABS } from "./types";

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
