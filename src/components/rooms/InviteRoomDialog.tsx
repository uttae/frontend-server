"use client";

import { AddMemberPanel } from "@/app/(main)/member-settings/_components/AddMemberPanel";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

/** 초대하기 모달 — PC 헤더와 홈 방 카드 메뉴가 같이 쓴다. 불러오기·오류·권한 안내는 `AddMemberPanel`이 맡는다 */
export function InviteRoomDialog({
  roomId,
  inviteCode,
  memberCount,
  role,
  isRoomDetailLoading,
  isRoomDetailError,
  onClose,
}: Readonly<{
  roomId: string;
  inviteCode: string | null | undefined;
  memberCount?: number;
  role?: string;
  isRoomDetailLoading: boolean;
  isRoomDetailError: boolean;
  onClose: () => void;
}>) {
  return (
    <SettingsDialog title="초대하기" appearance="alert" onClose={onClose}>
      <p className="text-body-l-regular text-text">링크를 공유해 함께 여행을 계획해 보세요.</p>
      <div className="mt-4">
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
      </div>
    </SettingsDialog>
  );
}
