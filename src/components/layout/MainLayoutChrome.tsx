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
  const keepDesktopMap = !isMobileDevice && roomId && (showDesktopMap || mapMountedRoom === roomId);
  const isPlanRoute = isPlanPathname(pathname);
  const showMobileSurface =
    isMobileDevice && (isMobileMapPathname(pathname) || isChatPathname(pathname));
  const showMobileSchedule = isMobileDevice && isPlanRoute;
  const mobileBack = getMobileBackLink(pathname, isMobileDevice);

  const legacyViewPath = isMobileDevice && isPlanRoute ? legacyPlanViewPath(searchParams.get("view")) : null;
  useEffect(() => {
    if (legacyViewPath) router.replace(legacyViewPath);
  }, [legacyViewPath, router]);


  return (
    <main className="flex h-dvh flex-col">
      <div className="relative mx-auto flex min-h-0 flex-1 w-full overflow-hidden rounded-none bg-white">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
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
