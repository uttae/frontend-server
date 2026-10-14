"use client";

import {
  RoomTripDeleteButton,
  RoomTripSettingsSection,
} from "@/app/(main)/room-settings/_components/RoomTripSettingsSection";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

export function RoomTripEditDialog({ onClose }: { onClose: () => void }) {
  return (
    <SettingsDialog title="여행 정보 수정" onClose={onClose} size="medium" className="rounded-xl">
      <div className="pt-4">
        <RoomTripSettingsSection embedded onSaved={onClose} />
      </div>
      {/* 여행 삭제는 적용하기 아래 모달 오른쪽 끝 — 방장이 아니면 버튼이 없어 줄째 숨긴다 */}
      <div className="mt-3 flex justify-end empty:hidden">
        <RoomTripDeleteButton />
      </div>
    </SettingsDialog>
  );
}
