"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useSessionPromptVisible } from "@/hooks/useSessionPromptVisible";
import { FEEDBACK_FORM_URL } from "@/lib/contact";
import { MAIN_SIDEBAR_RAIL_WIDTH } from "@/lib/layout-tokens";
import { buildMobilePlanPanelHref, type MobilePlanPanel } from "@/lib/mobile-view";
import { RoomTripEditDialog } from "@/components/rooms/RoomTripEditDialog";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import {
  formatRoomTripSubtitleKo,
  tripYmdBoundsFromRoomSources,
} from "@/lib/plan/tripRange";
import { FEEDBACK_FORM_CLICKED_KEY } from "./sidebarFeedbackForm";

const mobileIcon = {
  roomLogo: "/icons/mobile/room-logo.svg",
  back: "/icons/mobile/back.svg",
  calendar: "/icons/mobile/calendar.svg",
  map: "/icons/mobile/map.svg",
  menu: "/icons/mobile/menu.svg",
  edit: "/icons/mobile/edit.svg",
  members: "/icons/mobile/members.svg",
  feedback: "/icons/mobile/feedback.svg",
  bug: "/icons/mobile/bug.svg",
} as const;

function MobileMenuIcon({ src }: { src: string }) {
  return <span aria-hidden className="block size-5 shrink-0 bg-icon" style={{ mask: `url('${src}') center / contain no-repeat` }} />;
}

const HeaderBar = ({
  mobilePlanPanel = "schedule",
  mobileBackHref,
  mobileBackLabel = "뒤로 가기",
}: {
  mobilePlanPanel?: MobilePlanPanel;
  mobileBackHref?: string;
  mobileBackLabel?: string;
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const pathname = usePathname();
  const [menuState, setMenuState] = useState({ path: pathname, open: false });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const { isMobileDevice } = useMobileView();
  if (menuState.path !== pathname) setMenuState({ path: pathname, open: false });
  const menuOpen = menuState.path === pathname && menuState.open;
  const closeMenu = () => setMenuState({ path: pathname, open: false });
  const isPlanRoute = pathname === "/plan" || Boolean(pathname?.startsWith("/plan/"));
  const { dismiss: dismissFeedbackPrompt } = useSessionPromptVisible(FEEDBACK_FORM_CLICKED_KEY);
  const { roomId } = useCurrentRoomId();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const { data, isPending } = useRoomsList();
  const { data: roomDetail } = useRoomDetail(rid || null);

  const listRooms = data?.rooms;
  const tripMeta = useMemo(
    () =>
      rid.length
        ? tripYmdBoundsFromRoomSources(rid, listRooms, roomDetail ?? undefined)
        : { startYmd: "", endYmd: "" },
    [listRooms, rid, roomDetail],
  );

  const currentRoom = rid.length
    ? (listRooms ?? []).find((r) => r.id === rid)
    : undefined;

  const dateStr = currentRoom
    ? formatRoomTripSubtitleKo(tripMeta.startYmd, tripMeta.endYmd)
    : "";
  const mobileDateStr = tripMeta.startYmd && tripMeta.endYmd
    ? `${tripMeta.startYmd.slice(2).replaceAll("-", "/")} - ${tripMeta.endYmd.slice(2).replaceAll("-", "/")}`
    : "일정 없음";

  const displayTitle =
    currentRoom?.title?.trim() ||
    (roomDetail?.id === rid ? roomDetail.title?.trim() : "") ||
    "";

  const isMapPanel = mobilePlanPanel === "map";
  const mapHref = buildMobilePlanPanelHref(pathname || "/plan", isMapPanel ? "schedule" : "map");
  const mobileTitle = displayTitle ? (
    <>
      <div className="truncate text-[18px] font-bold leading-[26px] tracking-[-0.02em] text-text">{displayTitle}</div>
      <div className="truncate text-[11px] leading-4 tracking-[-0.02em] text-text-subtle">{mobileDateStr}</div>
    </>
  ) : (
    <span className="block truncate text-[18px] font-bold leading-[26px] text-text" aria-busy={isPending}>
      {isPending ? "…" : "방 정보 없음"}
    </span>
  );

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuState({ path: pathname, open: false });
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuState({ path: pathname, open: false });
      menuButtonRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, pathname]);

  return (
    <header className={isMobileDevice ? "relative z-30 h-14 shrink-0 bg-fill-subtle" : "h-14 shrink-0 border-b-2 border-primary"}>
      {isMobileDevice ? (
        <div className={mobileBackHref ? "flex h-full min-w-0 items-center gap-1 pl-0.5" : "flex h-full min-w-0 items-center gap-[14px] px-2"}>
          {mobileBackHref ? (
            <Link href={mobileBackHref} aria-label={mobileBackLabel} className="flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary">
              <Image src={mobileIcon.back} alt="" width={24} height={24} />
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-0.5">
              <Link href="/home" aria-label="홈으로 이동" className="flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary">
                <Image src={mobileIcon.roomLogo} alt="" width={22} height={22} />
              </Link>
              <span aria-hidden className="h-9 w-px bg-border-subtle" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {mobileTitle}
          </div>
          {!mobileBackHref ? <div className="flex shrink-0 items-center">
            {isPlanRoute ? <Link href={mapHref} aria-label={isMapPanel ? "일정 보기" : "지도 보기"} className="flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              <span aria-hidden className="block size-6 bg-icon" style={{ mask: `url('${isMapPanel ? mobileIcon.calendar : mobileIcon.map}') center / contain no-repeat` }} />
            </Link> : null}
            <div ref={menuRef} className="relative">
              <button
                ref={menuButtonRef}
                type="button"
                aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
                aria-expanded={menuOpen}
                onClick={() => setMenuState({ path: pathname, open: !menuOpen })}
                className="flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span aria-hidden className="block size-6 bg-icon" style={{ mask: `url('${mobileIcon.menu}') center / contain no-repeat` }} />
              </button>
              {menuOpen ? (
                <nav aria-label="여행방 메뉴" className="absolute right-0 top-[38px] z-50 min-w-40 overflow-hidden rounded-xl bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
                  <button type="button" onClick={() => { closeMenu(); setEditOpen(true); }} className="flex min-h-12 w-full items-center gap-2 border-b border-border-subtle px-4 text-left text-[14px] font-medium tracking-[-0.02em] text-text hover:bg-fill-default">
                    <MobileMenuIcon src={mobileIcon.edit} />방 정보 수정
                  </button>
                  <Link href="/member-settings" onClick={closeMenu} className="flex min-h-12 items-center gap-2 border-b border-border-subtle px-4 text-[14px] font-medium tracking-[-0.02em] text-text hover:bg-fill-default">
                    <MobileMenuIcon src={mobileIcon.members} />멤버 관리
                  </Link>
                  <a href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" onClick={() => { dismissFeedbackPrompt(); closeMenu(); }} className="flex min-h-12 items-center gap-2 border-b border-border-subtle px-4 text-[14px] font-medium tracking-[-0.02em] text-text hover:bg-fill-default">
                    <MobileMenuIcon src={mobileIcon.feedback} />피드백
                  </a>
                  <a href="https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="flex min-h-12 items-center gap-2 px-4 text-[14px] font-medium tracking-[-0.02em] text-text hover:bg-fill-default">
                    <MobileMenuIcon src={mobileIcon.bug} />버그 제보
                  </a>
                </nav>
              ) : null}
            </div>
          </div> : null}
        </div>
      ) : (
        <div className="flex h-full items-center">
          <div className="relative flex h-full shrink-0 flex-col items-center justify-center" style={{ width: MAIN_SIDEBAR_RAIL_WIDTH }}>
            <Link href="/home" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-light-gray" aria-label="홈으로 이동">
              <BrandLogo variant="symbol" size="S" alt="" />
            </Link>
            <div className="pointer-events-none absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-gray-border" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-5 pr-2">
            <div className="min-w-0 bg-white">
              {currentRoom || displayTitle ? (
                <>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="block truncate text-body-m-emphasis mobile:text-body-s-emphasis font-semibold leading-tight">{displayTitle || currentRoom?.title}</span>
                    <button type="button" aria-label="여행 정보 수정" aria-haspopup="dialog" data-tutorial-target="room-settings" onClick={() => setEditOpen(true)} className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray hover:bg-light-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      <Pencil size={14} aria-hidden />
                    </button>
                  </div>
                  <span className="block truncate text-body-s-regular mobile:text-body-xs-regular leading-tight text-dark-gray">{dateStr}</span>
                </>
              ) : isPending ? (
                <span className="block text-body-m-emphasis mobile:text-body-s-emphasis font-semibold leading-tight text-dark-gray" aria-busy="true">…</span>
              ) : (
                <span className="block truncate text-body-m-emphasis mobile:text-body-s-emphasis font-semibold leading-tight text-dark-gray">방 정보 없음</span>
              )}
            </div>
          </div>
        </div>
      )}
      {editOpen ? <RoomTripEditDialog key={rid} onClose={closeEdit} /> : null}
    </header>
  );
};

export default HeaderBar;
