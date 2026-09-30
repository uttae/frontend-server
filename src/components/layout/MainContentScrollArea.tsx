"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import {
  MAIN_PAGE_INLINE_PADDING_CLASS,
  MAIN_SCROLLBAR_GUTTER_CLASS,
} from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

/**
 * (main) 좌측 본문 스크롤 영역 — 레이아웃이 유지되는 동안 브라우저가 scrollTop 을 남겨
 * 다른 탭에서 plan 등으로 올 때 이전 페이지 스크롤이 이어지는 문제를 막습니다.
 *
 * search 는 자체 패딩·내부 스크롤을 쓰므로 gutter/px 를 적용하지 않습니다.
 */
function isSearchPath(pathname: string): boolean {
  return pathname === "/search";
}

export function MainContentScrollArea({
  children,
  fill = false,
}: {
  children: ReactNode;
  fill?: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchPage = isSearchPath(pathname);
  const ledgerPage = pathname === "/cost" && !fill;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div
      ref={scrollRef}
      data-main-content-scroll
      className={cn(
        "min-h-0 min-w-0 flex-1",
        !fill && !ledgerPage && "pt-2.5",
        ledgerPage && "bg-fill-subtle mobile:bg-fill max-sm:bg-fill",
        fill
          ? "flex flex-col overflow-hidden"
          : searchPage
            ? "flex flex-col overflow-hidden"
            : cn(
                "overflow-x-hidden overflow-y-auto",
                MAIN_SCROLLBAR_GUTTER_CLASS,
              ),
      )}
    >
      <div
        className={cn(
          "min-w-0",
          (fill || searchPage) && "flex min-h-0 flex-1 flex-col",
          !fill && !searchPage && !ledgerPage && MAIN_PAGE_INLINE_PADDING_CLASS,
          ledgerPage && "p-8 mobile:p-5 max-sm:p-5",
        )}
      >
        {children}
      </div>
    </div>
  );
}
