"use client";

import { useEffect } from "react";
import { LogOut } from "lucide-react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bubble-gray">
            <LogOut size={22} className="text-dark-gray" />
          </div>
          <h2 className="text-title-s font-bold">정말 방에서 나가시겠어요?</h2>
          <p className="mt-1.5 text-body-m-regular leading-relaxed text-dark-gray">
            <span className="font-semibold">{room.title}</span> 방을 나가면
            현재 여행 플랜에 접근할 수 없게 됩니다.
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
            onClick={handleLeave}
            disabled={isPending}
          >
            {isPending ? "처리 중…" : "나가기"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      </div>
    </div>
  );
}
