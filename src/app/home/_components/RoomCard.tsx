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
  const dates = [room.startDate, room.endDate]
    .map((date) => date ? date.slice(2).replaceAll("-", "/") : "미정");
  const planPath = planPathForRoom(room.id);

  const handleNavigate = () => setCurrentRoomId(room.id);

  return (
    <article className="relative min-w-0">
      <Link
        href={planPath}
        onClick={handleNavigate}
        className="group block rounded-[12px] text-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="relative aspect-video overflow-hidden rounded-[12px] bg-fill-strong mobile:aspect-[353/198]">
          <Image
            src="/rooms/figma/trip-cover.png"
            alt=""
            fill
            loading={isFirst ? "eager" : "lazy"}
            sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 368px"
            className="object-cover transition-opacity group-hover:opacity-90"
          />
        </div>
        <div className="pb-5 pl-1 pr-16 pt-3 mobile:pb-4">
          <h2 className="max-w-[280px] truncate text-title-s" title={room.title}>
            {room.title}
          </h2>
          <div className="mt-2 space-y-0 text-body-s-emphasis text-text-subtle mobile:space-y-1 mobile:text-body-xs-emphasis">
            <p className="flex min-h-5 gap-0.5 overflow-hidden mobile:min-h-4" title={room.destinations.join(" · ")}>
              {room.destinations.map((destination, index) => (
                <span key={`${destination}-${index}`} className="inline-flex min-w-0 items-center gap-0.5">
                  {index > 0 && <span className="shrink-0">·</span>}
                  <span className="truncate">{destination}</span>
                </span>
              ))}
            </p>
            <p className="flex gap-0.5"><span>{dates[0]}</span><span>-</span><span>{dates[1]}</span></p>
          </div>
        </div>
      </Link>

      <div className="absolute bottom-[58px] right-0 z-10 mobile:bottom-[50px]">
        <RoomCardMenu room={room} onDelete={onDelete} onLeave={onLeave} />
      </div>
    </article>
  );
}
