"use client";

import { useEffect } from "react";
import { UserX } from "lucide-react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";

type Props = {
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
};

export function WithdrawAccountConfirmModal({
  onClose,
  onConfirm,
  isPending,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, isPending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-account-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-2 pt-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-negative/10">
            <UserX size={22} className="text-status-negative" aria-hidden />
          </div>
          <h2 id="withdraw-account-title" className="text-[19px] font-bold">
            정말 탈퇴하시겠어요?
          </h2>
          <p className="mt-3 text-left text-[17px] leading-relaxed text-dark-gray">
            탈퇴 후에는 계정을 복구할 수 없습니다. 
            <br />
            이메일·닉네임·프로필 등
            
            개인정보는 익명화되며,<br /> 참여 중이던 여행 멤버십은 정리됩니다.
          </p>
          <p className="mt-2 text-left text-[14px] leading-relaxed text-dark-gray">
            방장인 여행에 다른 멤버가 남아 있으면, 탈퇴 전 방장을 위임해야
            합니다.
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
            {isPending ? "탈퇴 처리 중…" : "탈퇴하기"}
          </SettingsActionButton>
        </SettingsActionButtonRow>
      </div>
    </div>
  );
}
