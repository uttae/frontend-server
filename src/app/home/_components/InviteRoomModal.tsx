"use client";

import { LoadingIndicator } from "@/components/loading/LoadingIndicator";

import { AddMemberPanel } from "@/app/(main)/member-settings/_components/AddMemberPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import type { RoomListItem } from "@/lib/api/rooms";
import { isRoomMemberRole } from "@/lib/rooms";

export function InviteRoomModal({ room, onClose }: {
  room: RoomListItem;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useRoomDetail(room.id);

  return (
    <SettingsDialog title="여행 초대" onClose={onClose}>
      <p className="mb-5 break-words text-body-m-emphasis text-text-subtle">{room.title}</p>
      {isLoading ? (
        <LoadingIndicator label="초대 링크 불러오는 중" className="w-full py-8" />
      ) : isError || !data ? (
        <div role="alert" className="space-y-4 py-6 text-center">
          <p className="text-body-m-regular text-text-subtle">방 정보를 불러오지 못했어요.</p>
          <button type="button" onClick={() => void refetch()} className="rounded-[12px] bg-primary px-5 py-3 text-label-l-emphasis text-text-inverse">다시 시도</button>
        </div>
      ) : !isRoomMemberRole(data.role) ? (
        <p className="py-8 text-center text-body-m-regular text-text-subtle">여행 멤버만 초대 링크를 공유할 수 있어요.</p>
      ) : (
        <AddMemberPanel
          key={room.id}
          roomId={room.id}
          inviteCode={data.inviteCode}
          memberCount={data.memberCount}
          role={data.role}
          isRoomDetailLoading={false}
          isRoomDetailError={false}
        />
      )}
    </SettingsDialog>
  );
}
