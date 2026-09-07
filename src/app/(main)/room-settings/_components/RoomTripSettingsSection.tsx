"use client";

import { RoomTripEditForm } from "@/components/rooms/RoomTripEditForm";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { useCurrentRoomMembership } from "@/hooks/useCurrentRoomMembership";

export function RoomTripSettingsSection() {
  const { roomId, roomSource, isHost, isLoading } = useCurrentRoomMembership();

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <MainPageHeader
        title="여행 정보 수정"
        description={
          !isLoading && roomSource && roomId && !isHost
            ? "방장만 여행 정보를 수정할 수 있어요."
            : undefined
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
        </div>
      ) : !roomSource || !roomId ? (
        <p className="py-10 text-center text-[17px] text-dark-gray">
          여행 정보를 불러오지 못했어요.
        </p>
      ) : (
        <RoomTripEditForm room={roomSource} readOnly={!isHost} />
      )}
    </div>
  );
}
