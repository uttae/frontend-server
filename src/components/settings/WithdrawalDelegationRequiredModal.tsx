"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { SettingsActionButton } from "@/components/settings/SettingsActionButton";
import type { RoomRequiringDelegation } from "@/lib/api/user";
import { useSessionStore } from "@/stores/session-store";

type Props = {
  rooms: RoomRequiringDelegation[];
  onClose: () => void;
};

export function WithdrawalDelegationRequiredModal({ rooms, onClose }: Props) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleRoomClick(roomId: string) {
    useSessionStore.getState().setCurrentRoomId(roomId);
    onClose();
    router.push("/member-settings");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdrawal-delegation-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-2 pt-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <AlertCircle size={22} className="text-amber-600" aria-hidden />
          </div>
          <h2
            id="withdrawal-delegation-title"
            className="text-center text-title-s font-bold"
          >
            방장 위임이 필요해요
          </h2>
          <p className="mt-3 text-body-m-regular leading-relaxed text-dark-gray">
            아래 여행에서 방장을 다른 멤버에게 넘긴 뒤 탈퇴할 수 있어요. 여행
            이름을 누르면 멤버 설정으로 이동합니다.
          </p>
          {rooms.length > 0 && (
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-border bg-bubble-gray/40 p-2">
              {rooms.map((room) => (
                <li key={room.roomId}>
                  <button
                    type="button"
                    onClick={() => handleRoomClick(room.roomId)}
                    className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-label-l-regular font-medium text-gray-800 transition hover:bg-white"
                  >
                    {room.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-6 py-5 pt-2">
          <SettingsActionButton
            variant="primary"
            flex={false}
            className="w-full"
            onClick={onClose}
          >
            확인
          </SettingsActionButton>
        </div>
      </div>
    </div>
  );
}
