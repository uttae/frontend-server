"use client";

import { useRef, useState } from "react";
import { LogOut, MoreHorizontal, Trash2 } from "lucide-react";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { RoomListItem } from "@/lib/api/rooms";
import { isHostRole } from "@/lib/rooms";
import { cn } from "@/lib/utils";

type Props = {
  room: RoomListItem;
  onDelete: (room: RoomListItem) => void;
  onLeave: (room: RoomListItem) => void;
};

export function RoomCardMenu({ room, onDelete, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setOpen(false));

  const isHost = isHostRole(room.role);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 bg-white/90 transition [&_svg]:transition",
          "hover:border-primary hover:bg-primary [&_svg]:text-dark-gray hover:[&_svg]:text-white",
          open
            ? "border-primary bg-primary [&_svg]:text-white"
            : "border-gray-border",
        )}
        aria-label="더보기"
        aria-expanded={open}
      >
        <MoreHorizontal size={13} className="transition" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-32 overflow-hidden rounded-xl border border-gray-border bg-white shadow-lg">
          {isHost ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                onDelete(room);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[17px] text-primary transition hover:bg-bubble-gray"
            >
              <Trash2 size={13} />
              삭제하기
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                onLeave(room);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-[17px] text-dark-gray transition hover:bg-bubble-gray"
            >
              <LogOut size={13} />
              방 나가기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
