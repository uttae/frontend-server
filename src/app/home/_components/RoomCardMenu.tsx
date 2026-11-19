"use client";

import { useRef, useState } from "react";
import Image from "next/image";

import { MenuDotVerticalIcon, SignLogoutIcon, TrashIcon } from "@/assets/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoomListItem } from "@/lib/api/rooms";
import { isHostRole, isRoomMemberRole } from "@/lib/rooms";

import { InviteRoomModal } from "./InviteRoomModal";

type Props = {
  room: RoomListItem;
  onDelete: (room: RoomListItem) => void;
  onLeave: (room: RoomListItem) => void;
};

export function RoomCardMenu({ room, onDelete, onLeave }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={triggerRef}
          aria-label={`${room.title} 더보기`}
          className="flex size-11 cursor-pointer items-center justify-center rounded-[8px] text-icon-subtle transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
        >
          <MenuDotVerticalIcon size={24} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" alignOffset={10} sideOffset={-2}>
          {isRoomMemberRole(room.role) ? (
            <DropdownMenuItem onClick={() => setInviteOpen(true)}>
              <Image src="/rooms/figma/invite.svg" alt="" width={20} height={20} className="size-5 shrink-0" />
              초대하기
            </DropdownMenuItem>
          ) : null}
          {isHostRole(room.role) ? (
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(room)}>
              <TrashIcon />
              방 삭제하기
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onLeave(room)}>
              <SignLogoutIcon />
              방 나가기
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {inviteOpen && (
        <InviteRoomModal room={room} finalFocus={triggerRef} onClose={() => setInviteOpen(false)} />
      )}
    </>
  );
}
