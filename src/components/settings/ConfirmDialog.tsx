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
  destructive?: boolean;
  appearance?: "default" | "ledger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  isPending = false,
  destructive = false,
  appearance = "default",
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
      appearance={appearance}
      stopPortalEventPropagation
    >
      {description ? (
        <p className={appearance === "ledger" ? "whitespace-pre-line text-[14px] leading-5 text-text-subtle" : "text-body-m-regular mobile:text-body-s-regular leading-relaxed text-dark-gray"}>
          {description}
        </p>
      ) : null}
      <SettingsActionButtonRow className="mt-6">
        <SettingsActionButton
          variant="secondary"
          className={appearance === "ledger" ? "h-12 rounded-lg text-[16px]" : undefined}
          onClick={handleClose}
          disabled={isPending}
        >
          {cancelLabel}
        </SettingsActionButton>
        <SettingsActionButton
          variant="primary"
          className={`${appearance === "ledger" ? "h-12 rounded-lg text-[16px]" : ""} ${destructive ? "bg-status-negative" : ""}`}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending ? "처리 중…" : confirmLabel}
        </SettingsActionButton>
      </SettingsActionButtonRow>
    </SettingsDialog>
  );
}
