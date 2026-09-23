"use client";

import Image from "next/image";
import { RoomListItem } from "@/lib/api/rooms";
import { RoomCard } from "./RoomCard";
import { NewTripLink } from "./NewTripLink";

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
  if (isLoading) {
    return (
      <div role="status" aria-label="여행 목록 불러오는 중" className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-border py-20 text-center">
        <p className="text-body-m-emphasis font-medium text-dark-gray">
          여행 목록을 불러오지 못했어요
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-label-l-emphasis font-semibold text-white transition hover:opacity-90"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-10 rounded-[8px] bg-fill px-5 py-20 text-center mobile:min-h-[410px] mobile:justify-start mobile:rounded-none mobile:bg-transparent mobile:px-0 mobile:pb-0 mobile:pt-[60px]">
        <div className="flex flex-col items-center gap-5 mobile:gap-3">
          <div aria-hidden className="size-10 mobile:size-[30px]">
            <Image src="/rooms/figma/empty-symbol-desktop.svg" alt="" width={40} height={40} className="block mobile:hidden" />
            <Image src="/rooms/figma/empty-symbol-mobile.svg" alt="" width={30} height={30} className="hidden mobile:block" />
          </div>
          <p className="text-body-m-emphasis text-text-subtle mobile:text-body-s-regular">
            아직 생성된 여행방이 없어요<br />
            우때와 함께 여행계획을 시작해보아요!
          </p>
        </div>
        <NewTripLink />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 mobile:grid-cols-1 mobile:gap-y-4">
      {rooms.map((room, index) => (
        <RoomCard
          key={room.id}
          room={room}
          isFirst={index === 0}
          onDelete={onDelete}
          onLeave={onLeave}
        />
      ))}
    </div>
  );
}
