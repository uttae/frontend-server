"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { InviteRoomModal } from "./InviteRoomModal";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { RoomListItem } from "@/lib/api/rooms";
import { isHostRole } from "@/lib/rooms";

type Props = {
  room: RoomListItem;
  onDelete: (room: RoomListItem) => void;
  onLeave: (room: RoomListItem) => void;
};

export function RoomCardMenu({ room, onDelete, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const closeInvite = useCallback(() => setInviteOpen(false), []);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useOnClickOutside(menuRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const isHost = isHostRole(room.role);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex size-11 cursor-pointer items-center justify-center rounded-[8px] transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${room.title} 더보기`}
        aria-expanded={open}
      >
        <Image src="/rooms/figma/menu.svg" alt="" width={24} height={24} className="size-6" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-[12px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)]">
          {isHost ? (
            <>
            <button
              type="button"
              onClick={() => {
                buttonRef.current?.focus();
                setOpen(false);
                setInviteOpen(true);
              }}
              className="flex h-12 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-border-subtle px-4 py-3.5 text-left text-label-m-regular text-text transition hover:bg-fill"
            >
              <Image src="/rooms/figma/invite.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
              초대하기
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                onDelete(room);
              }}
              className="flex h-12 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-border-subtle px-4 py-3.5 text-left text-label-m-regular text-status-negative transition hover:bg-fill"
            >
              <Image src="/rooms/figma/trash.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
              방 삭제하기
            </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                onLeave(room);
              }}
              className="flex h-12 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-border-subtle px-4 py-3.5 text-left text-label-m-regular text-text transition hover:bg-fill"
            >
              <LogOut size={20} aria-hidden />
              방 나가기
            </button>
          )}
        </div>
      )}
      {inviteOpen && <InviteRoomModal room={room} onClose={closeInvite} />}
    </div>
  );
}
