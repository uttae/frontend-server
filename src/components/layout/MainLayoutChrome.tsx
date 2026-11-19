"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isPackingPath } from "@/lib/room-context-path";
import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useChat } from "@/hooks/useChat";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import {
  isChatPathname,
  isMobileMapPathname,
  isPlanPathname,
  legacyPlanViewPath,
} from "@/lib/mobile-view";
import { ChatPanel } from "@/components/chat";
import { MapWithDetailPanel } from "@/components/map";

import { MobileMainTabs } from "@/components/mobile/MobileMainTabs";
import { MAIN_MAP_MIN_WIDTH_PX, MAIN_WORKSPACE_MIN_WIDTH_PX } from "@/lib/layout-tokens";
import { TravelToolsSwitcher } from "@/components/mobile/TravelToolsSwitcher";

import HeaderBar from "./HeaderBar";
import LeftSection from "./LeftSection";
import { MainContentScrollArea } from "./MainContentScrollArea";
import SideBar from "./SideBar";

function getMobileBackLink(
  pathname: string,
  isMobileDevice: boolean,
): { href: string; label: string } | undefined {
  if (!isMobileDevice) return undefined;
  if (pathname.startsWith("/bookmark/")) {
    return { href: "/bookmark", label: "북마크 목록으로 돌아가기" };
  }
  if (isMobileMapPathname(pathname)) {
    return { href: "/plan", label: "일정으로 돌아가기" };
  }
  return undefined;
}

export function MainLayoutChrome({ children }: { children: ReactNode }) {
  const { isMobileDevice } = useMobileView();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 최대화 채팅은 `/chat` 페이지가 그리고, 레이아웃은 다른 페이지 위에 떠 있는 최소화 채팅만 맡는다
  const { chatState } = useChat();
  const showDesktopChat = !isMobileDevice && chatState === "maximized";

  const isPackingRoute = isPackingPath(pathname);
  const showFullWidthPacking = isPackingRoute && !showDesktopChat;
  const { roomId } = useCurrentRoomId();
  const showDesktopMap = !isMobileDevice && (pathname !== "/cost" || showDesktopChat) && !showFullWidthPacking;
  const [mapMountedRoom, setMapMountedRoom] = useState<string | null>(null);
  if (showDesktopMap && roomId && mapMountedRoom !== roomId) {
    setMapMountedRoom(roomId);
  }
  // Full-width tabs hide an existing map; direct entry does not create one.
  const keepDesktopMap = !isMobileDevice && roomId && (showDesktopMap || mapMountedRoom === roomId);
  const isPlanRoute = isPlanPathname(pathname);
  // 모바일 지도·채팅(`/map`, `/chat`)과 일정은 화면이 직접 스크롤을 관리한다(탭 고정 + 목록만 스크롤)
  const showMobileSurface =
    isMobileDevice && (isMobileMapPathname(pathname) || isChatPathname(pathname));
  const showMobileSchedule = isMobileDevice && isPlanRoute;
  // 뒤로가기 헤더(Figma Default / Type=Back): 북마크 상세 → 목록, 지도 → 일정
  const mobileBack = getMobileBackLink(pathname, isMobileDevice);

  // 예전 `/plan?view=map|chat` 주소로 들어오면 새 경로로 옮긴다(방은 `/plan/[roomId]`가 먼저 저장해 둔다)
  const legacyViewPath = isMobileDevice && isPlanRoute ? legacyPlanViewPath(searchParams.get("view")) : null;
  useEffect(() => {
    if (legacyViewPath) router.replace(legacyViewPath);
  }, [legacyViewPath, router]);


  return (
    <main className="flex h-dvh flex-col">
      <div className="relative mx-auto flex min-h-0 flex-1 w-full overflow-hidden rounded-none bg-white">
        {/* 좌측 영역과 지도의 최소 폭 합(768)보다 화면이 좁으면 페이지 대신 이 안에서 가로 스크롤한다 */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          {/* PC는 창 폭과 레이아웃 최소 폭(768) 중 큰 폭. 떠 있는 채팅도 여기 붙어 768보다 좁은 창에서는 768 레이아웃 오른쪽에 머물고 함께 스크롤된다 */}
          <div
            className="relative flex min-h-0 min-w-0 flex-1"
            style={isMobileDevice ? undefined : { minWidth: MAIN_WORKSPACE_MIN_WIDTH_PX + MAIN_MAP_MIN_WIDTH_PX }}
          >
            <LeftSection>
              <HeaderBar
                mobileBackHref={mobileBack?.href}
                mobileBackLabel={mobileBack?.label}
              />
              {isMobileDevice && (pathname === "/cost" || isPackingRoute) ? <TravelToolsSwitcher /> : null}
              <section className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                {!isMobileDevice ? <SideBar /> : null}
                <MainContentScrollArea fill={isPackingRoute || showMobileSurface || showMobileSchedule || showDesktopChat}>
                  {legacyViewPath ? null : children}
                </MainContentScrollArea>
              </section>
              <MobileMainTabs />
            </LeftSection>

            {keepDesktopMap ? <MapWithDetailPanel key={roomId} hidden={!showDesktopMap} /> : null}
            {!isMobileDevice && chatState === "minimized" ? <ChatPanel /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
