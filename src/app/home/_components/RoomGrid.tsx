"use client";

import { Monitor } from "lucide-react";

import { useMobileView } from "@/contexts/MobileViewContext";
import { RoomListItem } from "@/lib/api/rooms";
import { RoomCard } from "./RoomCard";

type Props = {
  rooms: RoomListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDelete: (room: RoomListItem) => void;
  onLeave: (room: RoomListItem) => void;
};

export function RoomGrid({
  rooms,
  isLoading,
  isError,
  onRetry,
  onDelete,
  onLeave,
}: Props) {
  const { isMobileDevice } = useMobileView();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-border py-20 text-center">
        <p className="text-[17px] font-medium text-dark-gray">
          여행 목록을 불러오지 못했어요
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-[17px] font-semibold text-white transition hover:opacity-90"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (rooms.length === 0) {
    if (isMobileDevice) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-border px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Monitor className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-[17px] font-semibold text-dark-gray">
              아직 참여 중인 여행이 없어요
            </p>
            <p className="text-[13px] leading-relaxed text-dark-gray/80">
              모바일에서는 새 여행을 만들 수 없어요.
              <br />
              PC나 노트북으로 접속해 여행을 만들거나,
              <br />
              친구에게 초대 링크를 받아 참여해보세요.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-border py-20 text-center">
        <p className="text-[17px] font-medium text-dark-gray">아직 여행이 없어요</p>
        <p className="mt-1 text-[14px] text-light-gray">
          새 여행 계획을 만들어 시작해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          onDelete={onDelete}
          onLeave={onLeave}
        />
      ))}
    </div>
  );
}
