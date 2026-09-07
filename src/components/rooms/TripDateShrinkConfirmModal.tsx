"use client";

import { useEffect } from "react";
import { CalendarRange } from "lucide-react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";

type Props = {
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function TripDateShrinkConfirmModal({
  isPending,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPending, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trip-date-shrink-dialog-title"
        aria-describedby="trip-date-shrink-dialog-desc"
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-negative/10">
            <CalendarRange size={22} className="text-status-negative" />
          </div>
          <h2
            id="trip-date-shrink-dialog-title"
            className="text-[19px] font-bold"
          >
            여행 기간을 줄일까요?
          </h2>
          <p
            id="trip-date-shrink-dialog-desc"
            className="mt-1.5 text-[17px] leading-relaxed text-dark-gray"
          >
            여행 기간을 줄이면 해당 일차에 포함된 장소도 함께 삭제돼요.
            계속할까요?
          </p>
        </div>
        <SettingsActionButtonRow className="px-6 py-5 pt-0">
          <SettingsActionButton
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            취소
          </SettingsActionButton>
          <SettingsActionButton
            variant="primary"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "저장 중…" : "계속하기"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      </div>
    </div>
  );
}
