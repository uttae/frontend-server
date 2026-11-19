"use client";

import { RoomTripDeleteButton, RoomTripSettingsSection } from "@/components/rooms/RoomTripSettingsSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateRoom } from "@/hooks/useRooms";

export function RoomTripEditDialog({ onClose }: { onClose: () => void }) {
  const update = useUpdateRoom();
  return (
    <Dialog
      open
      closeDisabled={update.isPending}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg" closeLabel="여행 정보 수정 닫기">
        <DialogHeader>
          <DialogTitle>여행 정보 수정</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <RoomTripSettingsSection update={update} onSaved={onClose} />
          <div className="flex justify-end empty:hidden">
            <RoomTripDeleteButton />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
