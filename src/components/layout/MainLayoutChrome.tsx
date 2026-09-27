"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useChat } from "@/hooks/useChat";
import { usePathname, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import { buildMobilePlanPanelHref, readMobilePlanPanel } from "@/lib/mobile-view";
import { ChatPanel } from "@/components/chat";
import { MapWithDetailPanel } from "@/components/map";

import { MobileMainTabs } from "@/components/mobile/MobileMainTabs";

import HeaderBar from "./HeaderBar";
import LeftSection from "./LeftSection";
import { MainContentScrollArea } from "./MainContentScrollArea";
import SideBar from "./SideBar";
import { SidebarTutorial } from "./SidebarTutorial";

export function MainLayoutChrome({ children }: { children: ReactNode }) {
  const { isMobileDevice } = useMobileView();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { chatState, closeChat } = useChat();
  const previousRoute = useRef(pathname);
  useEffect(() => {
    if (previousRoute.current !== pathname) closeChat();
    previousRoute.current = pathname;
  }, [pathname, closeChat]);
  const showDesktopChat = !isMobileDevice && chatState !== "closed";

  const isPlanRoute = pathname === "/plan" || pathname.startsWith("/plan/");
  const mobilePlanPanel =
    isMobileDevice && isPlanRoute
      ? readMobilePlanPanel(searchParams.get("view"))
      : "schedule";
  const showMobilePlanSurface =
    isMobileDevice && isPlanRoute && mobilePlanPanel !== "schedule";
  // 뒤로가기 헤더(Figma Default / Type=Back): 북마크 상세 → 목록, 지도 → 일정
  const mobileBack =
    isMobileDevice && pathname.startsWith("/bookmark/")
      ? { href: "/bookmark", label: "북마크 목록으로 돌아가기" }
      : showMobilePlanSurface && mobilePlanPanel === "map"
        ? { href: buildMobilePlanPanelHref(pathname, "schedule"), label: "일정으로 돌아가기" }
        : undefined;

  return (
    <main className="flex h-dvh flex-col">
      <div className="relative mx-auto flex min-h-0 flex-1 w-full overflow-hidden rounded-none bg-white">
        <LeftSection>
          <HeaderBar
            mobilePlanPanel={mobilePlanPanel}
            mobileBackHref={mobileBack?.href}
            mobileBackLabel={mobileBack?.label}
          />
          <section className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
            {!isMobileDevice ? <SideBar /> : null}
            <MainContentScrollArea fill={showMobilePlanSurface || showDesktopChat}>
              {showDesktopChat ? <ChatPanel inline /> : showMobilePlanSurface ? (
                mobilePlanPanel === "map" ? (
                  <MapWithDetailPanel mobileInline />
                ) : (
                  <ChatPanel mobileInline />
                )
              ) : (
                children
              )}
            </MainContentScrollArea>
          </section>
          <MobileMainTabs />
        </LeftSection>

        {!isMobileDevice ? <MapWithDetailPanel /> : null}
        {!isMobileDevice ? <SidebarTutorial /> : null}
      </div>
    </main>
  );
}
