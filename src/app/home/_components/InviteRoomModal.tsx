"use client";

import { AddMemberPanel } from "@/app/(main)/member-settings/_components/AddMemberPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import type { RoomListItem } from "@/lib/api/rooms";
import { isHostRole } from "@/lib/rooms";

export function InviteRoomModal({ room, onClose }: {
  room: RoomListItem;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useRoomDetail(room.id);

  return (
    <SettingsDialog title="여행 초대" onClose={onClose}>
      <p className="mb-5 break-words text-body-m-emphasis mobile:text-body-s-emphasis text-text-subtle">{room.title}</p>
      {isLoading ? (
        <p role="status" className="py-8 text-center text-body-m-regular mobile:text-body-s-regular text-text-subtle">초대 링크를 불러오는 중…</p>
      ) : isError || !data ? (
        <div role="alert" className="space-y-4 py-6 text-center">
          <p className="text-body-m-regular mobile:text-body-s-regular text-text-subtle">방 정보를 불러오지 못했어요.</p>
          <button type="button" onClick={() => void refetch()} className="rounded-[12px] bg-primary px-5 py-3 text-label-l-emphasis mobile:text-label-m-emphasis text-text-inverse">다시 시도</button>
        </div>
      ) : !isHostRole(data.role) ? (
        <p className="py-8 text-center text-body-m-regular mobile:text-body-s-regular text-text-subtle">방장만 멤버를 초대할 수 있어요.</p>
      ) : (
        <AddMemberPanel
          key={room.id}
          embedded
          roomId={room.id}
          inviteCode={data.inviteCode}
          memberCount={data.memberCount}
          role={data.role}
          isRoomDetailLoading={false}
          isRoomDetailError={false}
          onClose={onClose}
        />
      )}
    </SettingsDialog>
  );
}
