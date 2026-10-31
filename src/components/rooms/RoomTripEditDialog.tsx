"use client";

import {
  RoomTripDeleteButton,
  RoomTripSettingsSection,
} from "@/components/rooms/RoomTripSettingsSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * 여행 정보 수정 대화상자. 마운트되면 열린 상태라 HeaderBar가 조건부로 그린다.
 * 기간 축소 확인(RoomTripEditForm)·여행 삭제 확인(RoomTripDeleteButton)은 이 대화상자의 React 자식이라 위 레이어만 Esc·포커스를 받는다
 */
export function RoomTripEditDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* 지금 폭 600은 lg(640)로 붙였다(ui/dialog.tsx size 주석) */}
      <DialogContent size="lg" closeLabel="여행 정보 수정 닫기">
        <DialogHeader>
          <DialogTitle>여행 정보 수정</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <RoomTripSettingsSection onSaved={onClose} />
          {/* 여행 삭제는 적용하기 아래 오른쪽 끝 — 방장이 아니면 버튼이 없어 줄째 숨긴다 */}
          <div className="flex justify-end empty:hidden">
            <RoomTripDeleteButton />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
