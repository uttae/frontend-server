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

/** 회원 탈퇴 확인창(Figma Alert Dialog, Destructive). 마운트되면 열린 상태라 호출부가 조건부로 렌더한다 */
export function WithdrawAccountConfirmModal({
  onClose,
  onConfirm,
  isPending,
}: Props) {
  return (
    <AlertDialog
      open
      closeDisabled={isPending}
      // 열린 채 마운트되므로 닫기 요청(open=false)만 온다
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* 지금처럼 딤을 눌러도 닫힌다(처리 중에는 closeDisabled가 막는다) */}
      <AlertDialogContent backdropCloseLabel={`${TITLE} 배경 닫기`}>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE}</AlertDialogTitle>
          <AlertDialogDescription>
            {"탈퇴 후에는 계정을 복구할 수 없습니다.\n이메일·닉네임·프로필 등 개인정보는 익명화되며,\n참여 중이던 여행 멤버십은 정리됩니다."}
          </AlertDialogDescription>
          {/* 지금 화면처럼 본문보다 작은 보조 안내 */}
          <p className="text-body-s-regular text-text-subtle">
            방장인 여행에 다른 멤버가 남아 있으면, 탈퇴 전 방장을 위임해야 합니다.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            tone="critical"
            loading={isPending}
            loadingLabel="탈퇴 처리 중"
            onClick={onConfirm}
          >
            탈퇴하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
