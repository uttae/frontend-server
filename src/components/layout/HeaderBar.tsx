"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { MAIN_SIDEBAR_RAIL_WIDTH } from "@/lib/layout-tokens";
import { RoomTripEditDialog } from "@/components/rooms/RoomTripEditDialog";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import {
  formatRoomTripSubtitleKo,
  tripYmdBoundsFromRoomSources,
} from "@/lib/plan/tripRange";

const HeaderBar = () => {
  const [editOpen, setEditOpen] = useState(false);
  const closeEdit = useCallback(() => setEditOpen(false), []);
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

  const displayTitle =
    currentRoom?.title?.trim() ||
    (roomDetail?.id === rid ? roomDetail.title?.trim() : "") ||
    "";

  return (
    <header className="h-14 shrink-0 border-b-2 border-primary">
      <div className="flex h-full items-center">
        <div className="relative flex h-full shrink-0 flex-col items-center justify-center" style={{ width: MAIN_SIDEBAR_RAIL_WIDTH }}>
          <Link
            href="/home"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-light-gray"
            aria-label="홈으로 이동"
          >
            <BrandLogo variant="symbol" size="S" alt="" />
          </Link>
          <div
            className="pointer-events-none absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-gray-border"
            aria-hidden
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-5 pr-2">
          <div className="min-w-0 bg-white">
            {currentRoom || displayTitle ? (
              <>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="block truncate text-[17px] font-semibold leading-tight">
                    {displayTitle || currentRoom?.title}
                  </span>
                  <button
                    type="button"
                    aria-label="여행 정보 수정"
                    aria-haspopup="dialog"
                    data-tutorial-target="room-settings"
                    onClick={() => setEditOpen(true)}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray hover:bg-light-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                </div>
                <span className="block truncate text-[14px] leading-tight text-dark-gray">
                  {dateStr}
                </span>
              </>
            ) : isPending ? (
              <span
                className="block text-[17px] font-semibold leading-tight text-dark-gray"
                aria-busy="true"
              >
                …
              </span>
            ) : (
              <span className="block truncate text-[17px] font-semibold leading-tight text-dark-gray">
                방 정보 없음
              </span>
            )}
          </div>
        </div>
      </div>
      {editOpen ? <RoomTripEditDialog key={rid} onClose={closeEdit} /> : null}
    </header>
  );
};

export default HeaderBar;
