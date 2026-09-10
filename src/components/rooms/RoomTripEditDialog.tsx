"use client";

import { RoomTripSettingsSection } from "@/app/(main)/room-settings/_components/RoomTripSettingsSection";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

export function RoomTripEditDialog({ onClose }: { onClose: () => void }) {
  return (
    <SettingsDialog title="여행 정보 수정" onClose={onClose}>
      <RoomTripSettingsSection embedded onCancel={onClose} onSaved={onClose} />
    </SettingsDialog>
  );
}
