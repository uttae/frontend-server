"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { CookieSettingsButton } from "@/components/analytics/CookieSettingsProvider";
import { UserAvatar } from "@/components/user/UserAvatar";
import { SettingsActionButton } from "@/components/settings/SettingsActionButton";
import { WithdrawAccountConfirmModal } from "@/components/settings/WithdrawAccountConfirmModal";
import { WithdrawalDelegationRequiredModal } from "@/components/settings/WithdrawalDelegationRequiredModal";

import { useSessionUser } from "@/hooks/useSessionUser";
import { logout } from "@/lib/api/auth";
import { tearDownClientSession } from "@/lib/client-storage";
import {
  withdrawAccount,
  type RoomRequiringDelegation,
} from "@/lib/api/user";

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: "Google",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export default function MyInfoPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isFetching, refetch } = useSessionUser();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [delegationRooms, setDelegationRooms] = useState<
    RoomRequiringDelegation[] | null
  >(null);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const result = await logout().catch(() => {});
    setIsLoggingOut(false);
    if (!result?.ok) {
      toast.error("로그아웃에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    tearDownClientSession({ queryClient });
    router.replace("/");
  }

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
    } catch {
      toast.error("회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-xl">
          <Link
            href="/home"
            className="inline-flex items-center gap-1 text-label-m-regular text-dark-gray transition hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            방 목록으로 돌아가기
          </Link>

          <h1 className="mt-4 text-heading-s font-bold tracking-tight text-neutral-900">
            내 정보
          </h1>

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-border border-t-primary" />
            </div>
          )}

          {/* users/me 조회 실패는 예외 대신 null로 반환된다 */}
          {!isLoading && !user && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-border py-16 text-center">
              <p className="text-body-m-emphasis font-medium text-dark-gray">
                내 정보를 불러오지 못했어요
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-label-l-emphasis font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFetching ? "불러오는 중…" : "다시 시도"}
              </button>
            </div>
          )}

          {user && (
            <>
              <section className="mt-5 rounded-2xl border border-gray-border p-5">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size={56} />
                  <div className="min-w-0">
                    <p className="break-words text-body-m-emphasis font-semibold text-black">
                      {user.nickname}
                    </p>
                    <p className="text-body-xs-regular text-dark-gray">
                      {providerLabel(user.provider)}로 로그인 중
                    </p>
                  </div>
                </div>

                <dl className="mt-5 space-y-4 border-t border-gray-border pt-4">
                  <div>
                    <dt className="text-body-xs-regular text-dark-gray">이메일</dt>
                    <dd className="mt-1 break-all text-body-s-regular text-black">
                      {user.email}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-body-xs-regular text-dark-gray">
                      로그인 방식
                    </dt>
                    <dd className="mt-1 text-body-s-regular text-black">
                      {providerLabel(user.provider)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="mt-6">
                <h2 className="text-body-s-emphasis font-semibold text-dark-gray">
                  개인정보 설정
                </h2>
                <CookieSettingsButton className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-border px-4 py-3 text-left text-label-m-regular text-black transition hover:bg-bubble-gray">
                  분석 쿠키 설정
                  <ChevronRight className="h-4 w-4 text-dark-gray" aria-hidden />
                </CookieSettingsButton>
                <p className="mt-1.5 text-body-xs-regular text-dark-gray">
                  현재 브라우저의 분석 쿠키 허용 여부를 설정합니다.
                </p>
              </section>

              <div className="mt-8">
                <SettingsActionButton
                  variant="secondary"
                  flex={false}
                  className="w-full"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "로그아웃 중…" : "로그아웃"}
                </SettingsActionButton>

                <button
                  type="button"
                  onClick={() => setShowWithdrawConfirm(true)}
                  className="mt-3 block text-label-s-regular text-dark-gray underline underline-offset-2 transition hover:text-neutral-900"
                >
                  회원 탈퇴
                </button>
              </div>
            </>
          )}
        </div>
      </main>

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
