"use client";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { RoomListItem } from "@/lib/api/rooms";
import { useDeleteRoom } from "@/hooks/useRooms";

type Props = {
  room: Pick<RoomListItem, "id" | "title">;
  onClose: () => void;
  /** 삭제 API 성공 직후, `onClose` 호출 전에 실행 */
  onDeleted?: () => void;
};

export function DeleteConfirmModal({ room, onClose, onDeleted }: Props) {
  const { mutate: deleteRoom, isPending } = useDeleteRoom();

  function handleDelete() {
    deleteRoom(room.id, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
    });
  }

  return (
    <ConfirmDialog
      appearance="ledger"
      destructive
      title="여행을 삭제하시겠어요?"
      description={`${room.title}의 모든 정보가 삭제되며,\n삭제한 여행은 복구할 수 없어요.`}
      confirmLabel="여행 삭제"
      isPending={isPending}
      onConfirm={handleDelete}
      onCancel={onClose}
    />
  );
}
