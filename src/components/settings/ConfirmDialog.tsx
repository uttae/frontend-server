"use client";

import type { SyntheticEvent } from "react";

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
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 확인 동작 처리 중. Esc·딤·취소를 모두 막고 확인 버튼은 progress로 바뀐다 */
  isPending?: boolean;
  /** 삭제·탈퇴·나가기 같은 위험 동작이면 true(확인 버튼 Critical Solid) */
  destructive?: boolean;
  /** 확인 동작이 실패했을 때 버튼 아래에 보여줄 한 줄 안내 */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// 포털 안 이벤트가 React 트리를 따라 카드 클릭·드래그 호스트(PlanPlaceCard·BookmarkPlaceRow)로 올라가는 것만 막는다.
// Base UI 포털도 React 부모로 이벤트를 올리고, 딤의 '배경 닫기' 버튼은 표면 밖이라 표면 props로는 못 막아 Root 바깥을 감싼다.
// 감싼 요소는 display: contents라 호출부 배치에 상자를 더하지 않는다. 키 입력은 Base UI가 document에서 받으므로 막지 않는다
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/**
 * 확인창(Figma Alert Dialog 5621:3002). 마운트되면 열린 상태라 호출부는 조건부로 렌더한다.
 * 닫기 요청(Esc·딤·취소)은 모두 onCancel이고, 처리 중에는 모두 막힌다. 성공 뒤 닫기는 호출부가 언마운트로 한다.
 *
 * @example
 * {target ? (
 *   <ConfirmDialog destructive title="이 장소를 삭제할까요?" confirmLabel="삭제"
 *     isPending={isDeleting} onConfirm={handleDelete} onCancel={() => setTarget(null)} />
 * ) : null}
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isPending = false,
  destructive = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Readonly<Props>) {
  return (
    <div
      className="contents"
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onPointerDown={stopPropagation}
      onTouchStart={stopPropagation}
    >
      <AlertDialog
        open
        closeDisabled={isPending}
        // 열린 채 마운트되므로 닫기 요청(open=false)만 온다
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialogContent backdropCloseLabel={`${title} 배경 닫기`}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
              <AlertDialogAction
                tone={destructive ? "critical" : "neutral"}
                loading={isPending}
                loadingLabel="처리 중"
                onClick={onConfirm}
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
            {errorMessage ? (
              <p role="alert" className="text-center text-body-s-regular text-status-negative">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
