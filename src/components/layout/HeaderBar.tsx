"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useMemo } from "react";

import { BrandLogo } from "@/components/BrandLogo";

import { useCurrentRoomId } from "@/hooks/use-room-id";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { useRoomsList } from "@/hooks/useRooms";
import {
  formatRoomTripSubtitleKo,
  tripYmdBoundsFromRoomSources,
} from "@/lib/plan/tripRange";

const HeaderBar = () => {
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
    <header className="border-b-2 border-primary">
      <div className="flex items-center">
        <div className="relative flex w-13 shrink-0 flex-col items-center justify-center py-1.5">
          <Link
            href="/home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dark-gray transition-colors hover:bg-light-gray"
            aria-label="홈으로 이동"
          >
            <Home className="h-6 w-6" strokeWidth={2} aria-hidden />
          </Link>
          <div
            className="pointer-events-none absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-gray-border"
            aria-hidden
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-5 py-1 pr-2">
          <div className="min-w-0 bg-white py-1.5">
            {currentRoom || displayTitle ? (
              <>
                <span className="block truncate text-[17px] font-semibold leading-tight">
                  {displayTitle || currentRoom?.title}
                </span>
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
          <BrandLogo variant="combination" size="S" alt="로고" />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
