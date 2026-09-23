"use client";

import { useState } from "react";

import { useMobileView } from "@/contexts/MobileViewContext";
import { useRoomsList } from "@/hooks/useRooms";
import { RoomListItem } from "@/lib/api/rooms";

import { RoomGrid } from "../_components/RoomGrid";
import { DeleteConfirmModal } from "../_components/DeleteConfirmModal";
import { LeaveConfirmModal } from "../_components/LeaveConfirmModal";
import { NewTripLink } from "../_components/NewTripLink";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function HomePage() {
  const { isMobileDevice } = useMobileView();
  const { data, isLoading, isError, refetch } = useRoomsList();
  const rooms = data?.rooms ?? [];
  const isEmpty = !isLoading && !isError && rooms.length === 0;

  const [deletingRoom, setDeletingRoom] = useState<RoomListItem | null>(null);
  const [leavingRoom, setLeavingRoom] = useState<RoomListItem | null>(null);

  return (
    <>
      <main className={`mx-auto w-full max-w-[1184px] flex-1 px-6 pb-20 mobile:px-5 ${isEmpty ? "mobile:pb-0" : "mobile:pb-[60px]"}`}>
        <div className="flex items-center justify-between gap-3 py-5 mobile:py-4">
          <h1 className="text-heading-m text-text mobile:text-title-l">
            나의 여행
          </h1>
          {!isMobileDevice && (rooms.length > 0 || isLoading || isError) ? <NewTripLink /> : null}
        </div>

        <div>
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

      <SiteFooter variant="room-list" className="hidden mobile:block" />

      {isMobileDevice && !isEmpty ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(24px+env(safe-area-inset-bottom))] z-30 flex justify-center px-5">
          <NewTripLink className="pointer-events-auto shadow-[0_2px_5px_rgba(0,0,0,0.1)]" />
        </div>
      ) : null}

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
    </>
  );
}
