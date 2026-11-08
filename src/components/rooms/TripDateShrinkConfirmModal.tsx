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

/**
 * 여행 기간 축소 확인(Figma Alert Dialog). 마운트되면 열린 상태라 RoomTripEditForm이 조건부로 그린다.
 * 여행 정보 수정 대화상자의 React 자식이라 Esc·포커스 가두기는 이 확인창만 받고, 닫히면 수정 중인 입력이 그대로 남는다.
 * 딤·Esc·취소는 onClose, 저장 중에는 모두 막힌다. 버튼 이름은 ConfirmDialog와 달리 저장 진행("저장 중")을 읽어 직접 조립한다
 */
export function TripDateShrinkConfirmModal({
  isPending,
  onClose,
  onConfirm,
}: Readonly<Props>) {
  return (
    <AlertDialog
      open
      closeDisabled={isPending}
      // 열린 채 마운트되므로 닫기 요청(open=false)만 온다
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* 지금 확인창처럼 딤을 눌러도 닫힌다 */}
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
