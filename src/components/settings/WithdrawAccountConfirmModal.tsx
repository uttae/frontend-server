"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
};

const TITLE = "정말 탈퇴하시겠어요?";

export function WithdrawAccountConfirmModal({ onClose, onConfirm, isPending }: Props) {
  return (
    <AlertDialog
      open
      closeDisabled={isPending}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent backdropCloseLabel={`${TITLE} 배경 닫기`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE}</AlertDialogTitle>
          <AlertDialogDescription>
            {
              "탈퇴 후에는 계정을 복구할 수 없습니다.\n이메일·닉네임·프로필 등 개인정보는 익명화되며,\n참여 중이던 여행 멤버십은 정리됩니다."
            }
          </AlertDialogDescription>
          <p className="text-body-s-regular text-text-subtle">
            방장인 여행에 다른 멤버가 남아 있으면, 탈퇴 전 방장을 위임해야 합니다.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction tone="critical" loading={isPending} loadingLabel="탈퇴 처리 중" onClick={onConfirm}>
            탈퇴하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
