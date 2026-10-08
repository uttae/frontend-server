"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

import {
  alertDialogButtonClass,
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
  appearance?: "default" | "ledger" | "alert";
  /** 확인 동작이 실패했을 때 버튼 아래에 보여줄 한 줄 안내 — `alert`에서만 쓴다 */
  errorMessage?: string | null;
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
  errorMessage,
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

  if (appearance === "alert") {
    return (
      <SettingsDialog
        title={title}
        onClose={handleClose}
        appearance="alert"
        showCloseButton={false}
        stopPortalEventPropagation
      >
        {description ? <p className="whitespace-pre-line text-body-l-regular text-text">{description}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className={`flex-1 ${alertDialogButtonClass.secondary}`} onClick={handleClose} disabled={isPending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`flex-1 ${alertDialogButtonClass[destructive ? "critical" : "brand"]}`}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "처리 중…" : confirmLabel}
          </button>
        </div>
        {errorMessage ? (
          <p role="alert" className="mt-2 text-body-s-regular text-status-negative">
            {errorMessage}
          </p>
        ) : null}
      </SettingsDialog>
    );
  }

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
