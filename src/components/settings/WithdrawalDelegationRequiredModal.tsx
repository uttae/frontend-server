"use client";

import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RoomRequiringDelegation } from "@/lib/api/user";
import { useSessionStore } from "@/stores/session-store";

type Props = {
  rooms: RoomRequiringDelegation[];
  onClose: () => void;
};

const TITLE = "방장 위임이 필요해요";

export function WithdrawalDelegationRequiredModal({ rooms, onClose }: Props) {
  const router = useRouter();

  function handleRoomClick(roomId: string) {
    useSessionStore.getState().setCurrentRoomId(roomId);
    onClose();
    router.push("/member-settings");
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent backdropCloseLabel={`${TITLE} 배경 닫기`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE}</AlertDialogTitle>
          <AlertDialogDescription>
            아래 여행에서 방장을 다른 멤버에게 넘긴 뒤 탈퇴할 수 있어요. 여행
            이름을 누르면 멤버 설정으로 이동합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {rooms.length > 0 && (
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-fill-subtle p-2">
            {rooms.map((room) => (
              <li key={room.roomId}>
                <button
                  type="button"
                  onClick={() => handleRoomClick(room.roomId)}
                  className="w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-label-l-regular text-text transition-colors hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary mobile:text-label-m-regular"
                >
                  {room.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>확인</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
