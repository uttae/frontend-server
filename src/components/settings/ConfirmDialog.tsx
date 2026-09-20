"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

type Props = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isPending = false,
  onConfirm,
  onCancel,
}: Props) {
  // SettingsDialog는 onClose가 바뀔 때마다 포커스·inert를 다시 잡으므로 안정된 함수를 넘긴다
  const latest = useRef({ onCancel, isPending });
  useLayoutEffect(() => {
    latest.current = { onCancel, isPending };
  });
  const handleClose = useCallback(() => {
    if (!latest.current.isPending) latest.current.onCancel();
  }, []);

  return (
    <SettingsDialog
      title={title}
      onClose={handleClose}
      size="compact"
      stopPortalEventPropagation
    >
      {description ? (
        <p className="text-[17px] leading-relaxed text-dark-gray">
          {description}
        </p>
      ) : null}
      <SettingsActionButtonRow className="mt-6">
        <SettingsActionButton
          variant="secondary"
          onClick={handleClose}
          disabled={isPending}
        >
          {cancelLabel}
        </SettingsActionButton>
        <SettingsActionButton
          variant="primary"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "처리 중…" : confirmLabel}
        </SettingsActionButton>
      </SettingsActionButtonRow>
    </SettingsDialog>
  );
}
