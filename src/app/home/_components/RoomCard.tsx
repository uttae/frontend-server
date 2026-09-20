"use client";

import Link from "next/link";
import Image from "next/image";

import { RoomListItem } from "@/lib/api/rooms";
import { planPathForRoom } from "@/lib/join-room-workflow";
import { useSessionStore } from "@/stores/session-store";
import { RoomCardMenu } from "./RoomCardMenu";

type Props = {
  room: RoomListItem;
  onDelete: (room: RoomListItem) => void;
  onLeave: (room: RoomListItem) => void;
  isFirst?: boolean;
};

export function RoomCard({ room, onDelete, onLeave, isFirst = false }: Props) {
  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);
  const dateStr = [room.startDate, room.endDate]
    .map((date) => date ? date.slice(2).replaceAll("-", "/") : "미정")
    .join(" - ");
  const planPath = planPathForRoom(room.id);

  const handleNavigate = () => setCurrentRoomId(room.id);

  return (
    <article className="relative min-w-0">
      <Link
        href={planPath}
        onClick={handleNavigate}
        className="group block rounded-[12px] text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="relative aspect-video overflow-hidden rounded-[12px] bg-fill-strong">
          <Image
            src="/rooms/figma/trip-cover.png"
            alt=""
            fill
            loading={isFirst ? "eager" : "lazy"}
            sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 368px"
            className="object-cover transition-opacity group-hover:opacity-90"
          />
        </div>
        <div className="pb-5 pl-3 pr-14 pt-4 mobile:pb-4 mobile:pl-2 mobile:pt-3">
          <h2 className="truncate text-[20px] font-bold leading-7 tracking-[-0.02em]" title={room.title}>
            {room.title}
          </h2>
          <div className="mt-4 space-y-1 text-body-s-regular mobile:mt-3">
            <p className="min-h-5 truncate" title={room.destinations.join(" · ")}>{room.destinations.join(" · ")}</p>
            <p className="tabular-nums">{dateStr}</p>
          </div>
        </div>
      </Link>

      <div className="absolute bottom-[72px] right-1 z-10 mobile:bottom-16 mobile:right-0">
        <RoomCardMenu room={room} onDelete={onDelete} onLeave={onLeave} />
      </div>
    </article>
  );
}
