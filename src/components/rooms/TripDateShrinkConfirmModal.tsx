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
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const TITLE = "여행 기간을 줄일까요?";

export function TripDateShrinkConfirmModal({
  isPending,
  onClose,
  onConfirm,
}: Readonly<Props>) {
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
            여행 기간을 줄이면 제거되는 일차의 모든 장소와 비용도 함께 삭제돼요. 계속할까요?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction loading={isPending} loadingLabel="저장 중" onClick={onConfirm}>
            계속하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
