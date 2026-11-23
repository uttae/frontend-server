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
  isPending?: boolean;
  confirmDisabled?: boolean;
  destructive?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();
const pointerBoundary = {
  onClick: stopPropagation,
  onMouseDown: stopPropagation,
  onPointerDown: stopPropagation,
  onTouchStart: stopPropagation,
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isPending = false,
  confirmDisabled = false,
  destructive = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Readonly<Props>) {
  return (
    <AlertDialog
      open
      closeDisabled={isPending}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent
        {...pointerBoundary}
        backdropProps={pointerBoundary}
        backdropCloseLabel={`${title} 배경 닫기`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              tone={destructive ? "critical" : "neutral"}
              disabled={confirmDisabled}
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
  );
}
