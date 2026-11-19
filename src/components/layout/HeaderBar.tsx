"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ChevronLeftIcon, WriteIcon } from "@/assets/icons";
import { BrandLogo } from "@/components/BrandLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useSessionPromptVisible } from "@/hooks/useSessionPromptVisible";
import { FEEDBACK_FORM_URL } from "@/lib/contact";
import { MAIN_SIDEBAR_RAIL_WIDTH } from "@/lib/layout-tokens";
import { isChatPathname, isMobileMapPathname, isPlanPathname, MOBILE_MAP_PATH } from "@/lib/mobile-view";
import { isPackingPath } from "@/lib/room-context-path";
import { cn } from "@/lib/utils";
import { RoomTripEditDialog } from "@/components/rooms/RoomTripEditDialog";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import { formatRoomTripSubtitle, tripYmdBoundsFromRoomSources } from "@/lib/plan/tripRange";
import { HeaderMemberPreview } from "./HeaderMemberPreview";
import { FEEDBACK_FORM_CLICKED_KEY } from "./sidebarFeedbackForm";

const mobileIcon = {
  roomLogo: "/icons/mobile/room-logo.svg",
  calendar: "/icons/mobile/calendar.svg",
  map: "/icons/mobile/map.svg",
  menu: "/icons/mobile/menu.svg",
  edit: "/icons/mobile/edit.svg",
  members: "/icons/mobile/members.svg",
  feedback: "/icons/mobile/feedback.svg",
  bug: "/icons/mobile/bug.svg",
} as const;

function MobileMenuIcon({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="block size-5 shrink-0 bg-icon"
      style={{ mask: `url('${src}') center / contain no-repeat` }}
    />
  );
}

const HeaderBar = ({
  mobileBackHref,
  mobileBackLabel = "뒤로 가기",
}: {
  mobileBackHref?: string;
  mobileBackLabel?: string;
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const pathname = usePathname();
  const [menuState, setMenuState] = useState({ path: pathname, open: false });
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const { isMobileDevice } = useMobileView();
  if (menuState.path !== pathname) setMenuState({ path: pathname, open: false });
  const menuOpen = menuState.path === pathname && menuState.open;
  const isMapPanel = isMobileMapPathname(pathname ?? "");
  const showMapShortcut =
    isPlanPathname(pathname ?? "") ||
    isMapPanel ||
    isChatPathname(pathname ?? "") ||
    pathname === "/bookmark" ||
    pathname === "/cost" ||
    isPackingPath(pathname ?? "");
  const { dismiss: dismissFeedbackPrompt } = useSessionPromptVisible(FEEDBACK_FORM_CLICKED_KEY);
  const { roomId } = useCurrentRoomId();
  const rid = typeof roomId === "string" ? roomId.trim() : "";
  const { data, isPending } = useRoomsList();
  const { data: roomDetail } = useRoomDetail(rid || null);

  const listRooms = data?.rooms;
  const tripMeta = useMemo(
    () =>
      rid.length ? tripYmdBoundsFromRoomSources(rid, listRooms, roomDetail ?? undefined) : { startYmd: "", endYmd: "" },
    [listRooms, rid, roomDetail],
  );

  const currentRoom = rid.length ? (listRooms ?? []).find((r) => r.id === rid) : undefined;

  const tripDateLabel = formatRoomTripSubtitle(tripMeta.startYmd, tripMeta.endYmd);
  const dateStr = currentRoom ? tripDateLabel : "";

  const displayTitle = currentRoom?.title?.trim() || (roomDetail?.id === rid ? roomDetail.title?.trim() : "") || "";

  const mapHref = isMapPanel ? "/plan" : MOBILE_MAP_PATH;
  const hasRowBelowMobileHeader =
    isPlanPathname(pathname ?? "") || pathname === "/cost" || isPackingPath(pathname ?? "");
  const mobileTitle = displayTitle ? (
    <>
      <div className="truncate text-label-l-emphasis text-text">{displayTitle}</div>
      <div className="truncate text-caption-s-regular text-text-subtle">{tripDateLabel}</div>
    </>
  ) : (
    <span className="block truncate text-label-l-emphasis text-text" aria-busy={isPending}>
      {isPending ? "…" : "방 정보 없음"}
    </span>
  );

  return (
    <header
      className={
        isMobileDevice
          ? cn("relative z-30 h-14 shrink-0 bg-fill-subtle", !hasRowBelowMobileHeader && "border-b border-border")
          : "@container/header shrink-0 border-b border-border-subtle bg-fill-subtle"
      }
    >
      {isMobileDevice ? (
        <div
          className={
            mobileBackHref ? "flex h-full min-w-0 items-center pl-1" : "flex h-full min-w-0 items-center gap-4 px-2"
          }
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 pe-5">
            {mobileBackHref ? (
              <Link
                href={mobileBackHref}
                aria-label={mobileBackLabel}
                className="flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ChevronLeftIcon className="text-icon" />
              </Link>
            ) : (
              <Link
                href="/home"
                aria-label="홈으로 이동"
                className="flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Image src={mobileIcon.roomLogo} alt="" width={22} height={22} />
              </Link>
            )}
            <div className="min-w-0 flex-1">{mobileTitle}</div>
          </div>
          {!mobileBackHref ? (
            <div className="flex shrink-0 items-center">
              {showMapShortcut ? (
                <Link
                  href={mapHref}
                  aria-label={isMapPanel ? "일정 보기" : "지도 보기"}
                  className="flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    aria-hidden
                    className="block size-6 bg-icon"
                    style={{
                      mask: `url('${isMapPanel ? mobileIcon.calendar : mobileIcon.map}') center / contain no-repeat`,
                    }}
                  />
                </Link>
              ) : null}
              <DropdownMenu open={menuOpen} onOpenChange={(open) => setMenuState({ path: pathname, open })}>
                <DropdownMenuTrigger
                  aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
                  className="flex size-11 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    aria-hidden
                    className="block size-6 bg-icon"
                    style={{ mask: `url('${mobileIcon.menu}') center / contain no-repeat` }}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={-6} aria-label="여행방 메뉴">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <MobileMenuIcon src={mobileIcon.edit} />방 정보 수정
                  </DropdownMenuItem>
                  <DropdownMenuLinkItem render={<Link href="/member-settings" />}>
                    <MobileMenuIcon src={mobileIcon.members} />
                    초대하기
                  </DropdownMenuLinkItem>
                  <DropdownMenuLinkItem
                    href={FEEDBACK_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismissFeedbackPrompt}
                  >
                    <MobileMenuIcon src={mobileIcon.feedback} />
                    피드백
                  </DropdownMenuLinkItem>
                  <DropdownMenuLinkItem
                    href="https://docs.google.com/forms/d/e/1FAIpQLSfVohOtffMZkZwybOtNfZtMbDS-vl1u0QAfP9XM3w5hXDLEkA/viewform?usp=header"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MobileMenuIcon src={mobileIcon.bug} />
                    버그 제보
                  </DropdownMenuLinkItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-17 items-center">
          <div className="flex shrink-0 items-center justify-center" style={{ width: MAIN_SIDEBAR_RAIL_WIDTH }}>
            <Link
              href="/home"
              className="flex size-11 items-center justify-center rounded-full"
              aria-label="홈으로 이동"
            >
              <BrandLogo variant="symbol" size="S" alt="" />
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-5 ps-5 pe-3 @min-[480px]/header:pe-5">
            <div className="min-w-0">
              {currentRoom || displayTitle ? (
                <>
                  <div className="flex min-w-0 items-center gap-0.5">
                    <span className="block truncate text-title-s text-text">{displayTitle || currentRoom?.title}</span>
                    <button
                      type="button"
                      aria-label="여행 정보 수정"
                      aria-haspopup="dialog"
                      data-tutorial-target="room-settings"
                      onClick={() => setEditOpen(true)}
                      className="-m-2.75 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-icon-subtle hover:text-icon focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <WriteIcon size={18} />
                    </button>
                  </div>
                  <span className="block truncate text-body-s-regular text-text-subtle">{dateStr}</span>
                </>
              ) : isPending ? (
                <span className="block text-title-s text-text-subtle" aria-busy="true">
                  …
                </span>
              ) : (
                <span className="block truncate text-title-s text-text-subtle">방 정보 없음</span>
              )}
            </div>
            <HeaderMemberPreview />
          </div>
        </div>
      )}
      {editOpen ? <RoomTripEditDialog key={rid} onClose={closeEdit} /> : null}
    </header>
  );
};

export default HeaderBar;
