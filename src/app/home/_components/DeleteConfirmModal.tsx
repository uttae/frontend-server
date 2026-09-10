"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import { RoomListItem } from "@/lib/api/rooms";
import { useDeleteRoom } from "@/hooks/useRooms";

type Props = {
  room: RoomListItem;
  onClose: () => void;
  /** 삭제 API 성공 직후, `onClose` 호출 전에 실행 */
  onDeleted?: () => void;
};

export function DeleteConfirmModal({ room, onClose, onDeleted }: Props) {
  const { mutate: deleteRoom, isPending } = useDeleteRoom();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleDelete() {
    deleteRoom(room.id, {
      onSuccess: () => {
        onDeleted?.();
        onClose();
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-negative/10">
            <Trash2 size={22} className="text-status-negative" />
          </div>
          <h2 className="text-[19px] font-bold">여행을 삭제할까요?</h2>
          <p className="mt-1.5 text-[17px] text-dark-gray">
            <span className="font-semibold">{room.title}</span> 여행이 영구적으로
            삭제됩니다.
          </p>
        </div>
        <SettingsActionButtonRow className="px-6 py-5 pt-0">
          <SettingsActionButton
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            취소
          </SettingsActionButton>
          <SettingsActionButton
            variant="primary"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "삭제 중…" : "삭제하기"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      </div>
    </div>
  );
}
