"use client";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { useLeaveRoom } from "@/hooks/useRooms";
import { RoomListItem } from "@/lib/api/rooms";
import { useSessionStore } from "@/stores/session-store";

type Props = {
  room: RoomListItem;
  onClose: () => void;
};

export function LeaveConfirmModal({ room, onClose }: Props) {
  const { mutate: leaveRoom, isPending } = useLeaveRoom();
  const currentRoomId = useSessionStore((s) => s.currentRoomId);
  const clearCurrentRoomId = useSessionStore((s) => s.clearCurrentRoomId);

  function handleLeave() {
    leaveRoom(room.id, {
      onSuccess: () => {
        if (currentRoomId === room.id) {
          clearCurrentRoomId();
        }
        onClose();
      },
    });
  }

  return (
    <ConfirmDialog
      appearance="ledger"
      destructive
      title="방에서 나가시겠어요?"
      description={"방을 나가면 이 여행의 일정과 대화에\n더 이상 접근할 수 없어요."}
      confirmLabel="나가기"
      isPending={isPending}
      onConfirm={handleLeave}
      onCancel={onClose}
    />
  );
}
