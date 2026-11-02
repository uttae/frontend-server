"use client";

import type { ComponentProps } from "react";

import { AddMemberPanel } from "@/app/(main)/member-settings/_components/AddMemberPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * 초대하기 모달 — PC 헤더와 홈 방 카드 메뉴가 같이 쓴다. 불러오기·오류·권한 안내는 `AddMemberPanel`이 맡는다.
 * 마운트되면 열린 상태라 호출부가 조건부로 그린다. 메뉴 항목처럼 여는 요소가 닫힌 뒤 사라지면 finalFocus로 돌아갈 곳을 준다
 */
export function InviteRoomDialog({
  roomId,
  inviteCode,
  memberCount,
  role,
  isRoomDetailLoading,
  isRoomDetailError,
  onRetryRoomDetail,
  onClose,
  finalFocus,
}: Readonly<{
  roomId: string;
  inviteCode: string | null | undefined;
  memberCount?: number;
  role?: string;
  isRoomDetailLoading: boolean;
  isRoomDetailError: boolean;
  onRetryRoomDetail?: () => void;
  onClose: () => void;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
}>) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="md" closeLabel="초대하기 닫기" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>초대하기</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-body-l-regular text-text">링크를 공유해 함께 여행을 계획해 보세요.</p>
          <div className="flex flex-col gap-3">
            <AddMemberPanel
              key={roomId}
              roomId={roomId}
              inviteCode={inviteCode}
              memberCount={memberCount}
              role={role}
              isRoomDetailLoading={isRoomDetailLoading}
              isRoomDetailError={isRoomDetailError}
              showDescription={false}
            />
            {isRoomDetailError && onRetryRoomDetail ? (
              <button
                type="button"
                onClick={onRetryRoomDetail}
                disabled={isRoomDetailLoading}
                className="cursor-pointer self-start rounded-sm text-label-m-emphasis text-primary transition-colors enabled:hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                다시 시도
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
