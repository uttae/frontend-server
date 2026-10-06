"use client";

import {
  RoomTripDeleteButton,
  RoomTripSettingsSection,
} from "@/app/(main)/room-settings/_components/RoomTripSettingsSection";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

export function RoomTripEditDialog({ onClose }: { onClose: () => void }) {
  return (
    <SettingsDialog title="여행 정보 수정" onClose={onClose} size="medium" className="rounded-xl" titleAccessory={<RoomTripDeleteButton />}>
      <div className="pt-4">
        <RoomTripSettingsSection embedded onCancel={onClose} onSaved={onClose} />
      </div>
    </SettingsDialog>
  );
}
