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

const formatDate = (date: string) => date.slice(2).replaceAll("-", "/");

function TripDate({ date }: { date: string | null }) {
  if (!date) return <span>미정</span>;
  return <time dateTime={date}>{formatDate(date)}</time>;
}


export function RoomCard({ room, onDelete, onLeave, isFirst = false }: Props) {
  const setCurrentRoomId = useSessionStore((s) => s.setCurrentRoomId);
  const planPath = planPathForRoom(room.id);

  const handleNavigate = () => setCurrentRoomId(room.id);

  return (
    <article className="group relative min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-[8px] bg-fill-strong">
        <Image
          src="/rooms/figma/trip-cover.png"
          alt=""
          fill
          loading={isFirst ? "eager" : "lazy"}
          sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 368px"
          className="object-cover transition-opacity group-hover:opacity-90"
        />
      </div>

      <div className="flex items-start justify-between pb-4 pl-1 pt-1">
        <div className="flex min-w-0 max-w-[280px] flex-col gap-2.5 pt-2">
          <h2 className="truncate text-title-m text-text">
            {/* 카드 전체를 링크 영역으로 넓히되, 링크의 접근성 이름은 방 제목으로 유지한다 */}
            <Link
              href={planPath}
              onClick={handleNavigate}
              title={room.title}
              className="after:absolute after:inset-0 after:rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {room.title}
            </Link>
          </h2>

          <div className="space-y-0.5 text-body-s-regular text-text-subtle">
            <ul className="flex min-h-5 gap-0.5 overflow-hidden" title={room.destinations.join(" · ")}>
              {room.destinations.map((destination, index) => (
                <li key={`${destination}-${index}`} className="inline-flex min-w-0 items-center gap-0.5">
                  {index > 0 && <span aria-hidden className="shrink-0">·</span>}
                  <span className="truncate">{destination}</span>
                </li>
              ))}
            </ul>
            <p className="flex gap-0.5">
              <TripDate date={room.startDate} />
              <span aria-hidden>-</span>
              <TripDate date={room.endDate} />
            </p>
          </div>
        </div>

        <div className="relative z-10 shrink-0">
          <RoomCardMenu room={room} onDelete={onDelete} onLeave={onLeave} />
        </div>
      </div>
    </article>
  );
}
