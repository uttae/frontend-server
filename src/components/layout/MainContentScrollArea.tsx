"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { MAIN_PAGE_INLINE_PADDING_CLASS, MAIN_SCROLLBAR_GUTTER_CLASS } from "@/lib/layout-tokens";
import { cn } from "@/lib/utils";

function isSearchPath(pathname: string): boolean {
  return pathname === "/search";
}

export function MainContentScrollArea({ children, fill = false }: Readonly<{ children: ReactNode; fill?: boolean }>) {
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
        !fill && searchPage && "pt-2.5",
        ledgerPage && "bg-fill-subtle mobile:bg-fill",
        fill
          ? "flex flex-col overflow-hidden"
          : searchPage
            ? "flex flex-col overflow-hidden"
            : cn("overflow-x-hidden overflow-y-auto", MAIN_SCROLLBAR_GUTTER_CLASS),
      )}
    >
      <div
        className={cn(
          "min-w-0",
          (fill || searchPage) && "flex min-h-0 flex-1 flex-col",
          !fill && !searchPage && MAIN_PAGE_INLINE_PADDING_CLASS,
          ledgerPage && "pb-8 mobile:p-5",
        )}
      >
        {children}
      </div>
    </div>
  );
}
