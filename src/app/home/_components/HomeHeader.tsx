"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/BrandLogo";
import { PrivacySettingsLink } from "@/components/analytics/PrivacySettingsLink";
import { WithdrawAccountConfirmModal } from "@/components/settings/WithdrawAccountConfirmModal";
import { WithdrawalDelegationRequiredModal } from "@/components/settings/WithdrawalDelegationRequiredModal";

import { useQueryClient } from "@tanstack/react-query";

import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { logout } from "@/lib/api/auth";
import { useSessionUser } from "@/hooks/useSessionUser";
import { tearDownClientSession } from "@/lib/client-storage";
import {
  withdrawAccount,
  type RoomRequiringDelegation,
} from "@/lib/api/user";

function UserAvatar({
  user,
}: {
  user: { nickname: string; profileImageUrl: string | null };
}) {
  const initial = user.nickname.charAt(0);

  if (user.profileImageUrl) {
    return (
      <Image
        src={user.profileImageUrl}
        alt={user.nickname}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }

  return <span className="text-[14px] font-semibold text-white">{initial}</span>;
}

export function HomeHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [delegationRooms, setDelegationRooms] = useState<
    RoomRequiringDelegation[] | null
  >(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(profileRef, () => setOpen(false));

  const { data: user } = useSessionUser();

  const handleLogout = async () => {
    await logout();
    tearDownClientSession({ queryClient });
    router.replace("/");
  };

  async function handleWithdrawConfirm() {
    setIsWithdrawing(true);
    try {
      const result = await withdrawAccount();
      if (result.ok) {
        setShowWithdrawConfirm(false);
        queryClient.clear();
        tearDownClientSession({ queryClient });
        router.replace("/");
        return;
      }
      if (result.kind === "host_delegation_required") {
        setShowWithdrawConfirm(false);
        setDelegationRooms(result.rooms);
        return;
      }
      toast.error(result.message ?? "회원 탈퇴에 실패했습니다.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-2">
          <BrandLogo 
          variant="combination"
          size="S"
          alt="로고" />

          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary transition hover:opacity-90"
              aria-label="프로필"
              aria-expanded={open}
            >
              {user ? (
                <UserAvatar user={user} />
              ) : (
                <span className="text-[14px] font-semibold text-white">?</span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-border bg-white shadow-lg">
                {user && (
                  <div className="border-b border-gray-border px-4 py-2.5">
                    <p className="truncate text-[14px] font-semibold text-black">
                      {user.nickname}
                    </p>
                    <p className="truncate text-[13px] text-dark-gray">
                      {user.email}
                    </p>
                  </div>
                )}
                <PrivacySettingsLink
                  onClick={() => setOpen(false)}
                  className="block w-full px-4 py-2.5 text-left text-[17px] text-dark-gray transition hover:bg-bubble-gray"
                >
                  개인정보 설정
                </PrivacySettingsLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-[17px] text-dark-gray transition hover:bg-bubble-gray"
                >
                  로그아웃
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowWithdrawConfirm(true);
                  }}
                  className="w-full border-t border-gray-border px-4 py-2.5 text-left text-[17px] text-primary transition hover:bg-primary/5"
                >
                  회원 탈퇴
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showWithdrawConfirm && (
        <WithdrawAccountConfirmModal
          onClose={() => {
            if (!isWithdrawing) setShowWithdrawConfirm(false);
          }}
          onConfirm={() => {
            void handleWithdrawConfirm();
          }}
          isPending={isWithdrawing}
        />
      )}

      {delegationRooms && (
        <WithdrawalDelegationRequiredModal
          rooms={delegationRooms}
          onClose={() => setDelegationRooms(null)}
        />
      )}
    </>
  );
}
