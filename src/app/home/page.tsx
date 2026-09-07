"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";

import { MobileReadOnlyNotice } from "@/components/mobile/MobileReadOnlyNotice";
import { useMobileView } from "@/contexts/MobileViewContext";
import { useRoomsList } from "@/hooks/useRooms";
import {
  pageToolbarButtonIconClass,
  pageToolbarButtonIconStroke,
  pageToolbarButtonPaddingClass,
} from "@/components/layout/page-toolbar-button";
import { cn } from "@/lib/utils";
import { RoomListItem } from "@/lib/api/rooms";
import { SiteFooter } from "@/components/layout/SiteFooter";

import { HomeHeader } from "./_components/HomeHeader";
import { RoomGrid } from "./_components/RoomGrid";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";
import { LeaveConfirmModal } from "./_components/LeaveConfirmModal";

export default function HomePage() {
  const { isMobileDevice } = useMobileView();
  const { data, isLoading, isError, refetch } = useRoomsList();
  const rooms = data?.rooms ?? [];

  const [deletingRoom, setDeletingRoom] = useState<RoomListItem | null>(null);
  const [leavingRoom, setLeavingRoom] = useState<RoomListItem | null>(null);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MobileReadOnlyNotice />
      <HomeHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold tracking-tight text-neutral-900 mobile:text-[20px]">
              우리의 여행
            </h1>
            <p className="mt-1 text-[14px] leading-relaxed text-dark-gray">
              함께 계획 중인 여행 방을 한눈에 확인해보세요
            </p>
          </div>
          {!isMobileDevice ? (
            <Link
              href="/home/new"
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full bg-primary text-[17px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90",
                pageToolbarButtonPaddingClass,
              )}
            >
              <Plus
                className={pageToolbarButtonIconClass}
                strokeWidth={pageToolbarButtonIconStroke}
                aria-hidden
              />
              새 여행 계획
            </Link>
          ) : null}
        </div>

        <div className="mt-5">
          <RoomGrid
            rooms={rooms}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            onDelete={setDeletingRoom}
            onLeave={setLeavingRoom}
          />
        </div>
      </main>

      <SiteFooter />

      {deletingRoom && (
        <DeleteConfirmModal
          room={deletingRoom}
          onClose={() => setDeletingRoom(null)}
        />
      )}

      {leavingRoom && (
        <LeaveConfirmModal
          room={leavingRoom}
          onClose={() => setLeavingRoom(null)}
        />
      )}
    </div>
  );
}
