"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { completeGoogleReaccept, completeGoogleSignup } from "@/lib/api/auth";
import {
  GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_ERROR_CODE,
  GOOGLE_SIGNUP_TOKEN_NOT_FOUND_ERROR_CODE,
} from "@/lib/api/errors";
import { finishGoogleLogin } from "@/lib/google-login-client";
import {
  clearGoogleAgreementFlowSession,
  type GoogleAgreementFlowSession,
  readGoogleAgreementFlowSession,
} from "@/lib/google-oauth";
import { AgreementConsentSection } from "@/components/agreements/AgreementConsentSection";
import type { AgreementConsentState } from "@/components/agreements/AgreementConsentSection";
import { AuthFlowSpinner } from "@/components/auth/AuthFlowSpinner";
import { BrandLogo } from "@/components/BrandLogo";

const SIGNUP_EXPIRED_MESSAGE =
  "가입 요청이 만료되었거나 다른 로그인 시도로 무효화되었습니다. 다시 로그인해 주세요.";
const REACCEPT_EXPIRED_MESSAGE =
  "재동의 요청이 만료되었거나 다른 로그인 시도로 무효화되었습니다. 다시 로그인해 주세요.";

function expiredMessageForFlow(kind: "signup" | "reaccept"): string {
  return kind === "signup" ? SIGNUP_EXPIRED_MESSAGE : REACCEPT_EXPIRED_MESSAGE;
}

const INITIAL_CONSENT_STATE: AgreementConsentState = {
  isLoading: true,
  isError: false,
  canProceed: false,
};

export default function LoginAgreementsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<GoogleAgreementFlowSession | null>(null);
  const [isFlowReady, setIsFlowReady] = useState(false);
  const [consentState, setConsentState] = useState(INITIAL_CONSENT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const storedFlow = readGoogleAgreementFlowSession();
    if (!storedFlow) {
      router.replace("/login");
      return;
    }

    if (Date.now() >= storedFlow.expiresAt) {
      clearGoogleAgreementFlowSession();
      setFlow(storedFlow);
      setIsExpired(true);
      setErrorMessage(expiredMessageForFlow(storedFlow.kind));
      setIsFlowReady(true);
      return;
    }

    setFlow(storedFlow);
    setIsFlowReady(true);
  }, [router]);

  const returnToLogin = () => {
    clearGoogleAgreementFlowSession();
    router.replace("/login");
  };

  const handleSubmit = async () => {
    if (!flow || !consentState.canProceed || isSubmitting || isExpired) return;

    setErrorMessage(null);

    if (Date.now() >= flow.expiresAt) {
      clearGoogleAgreementFlowSession();
      setIsExpired(true);
      setErrorMessage(expiredMessageForFlow(flow.kind));
      return;
    }

    setIsSubmitting(true);
    try {
      if (flow.kind === "reaccept") {
        const result = await completeGoogleReaccept(flow.reacceptanceToken);
        if (!result.ok) {
          if (
            result.errorCode ===
            GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_ERROR_CODE
          ) {
            clearGoogleAgreementFlowSession();
            setIsExpired(true);
            setErrorMessage(REACCEPT_EXPIRED_MESSAGE);
          } else {
            setErrorMessage(result.message);
          }
          return;
        }
      } else {
        const result = await completeGoogleSignup(flow.signupToken);
        if (!result.ok) {
          if (
            result.errorCode === GOOGLE_SIGNUP_TOKEN_NOT_FOUND_ERROR_CODE
          ) {
            clearGoogleAgreementFlowSession();
            setIsExpired(true);
            setErrorMessage(SIGNUP_EXPIRED_MESSAGE);
          } else {
            setErrorMessage(result.message);
          }
          return;
        }
      }

      const destination = await finishGoogleLogin(queryClient);
      router.replace(destination ?? "/login?error=OAuthCallback");
    } catch {
      setErrorMessage(
        flow.kind === "reaccept"
          ? "약관 재동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."
          : "가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isFlowReady || !flow) return <AuthFlowSpinner />;

  const isSignup = flow.kind === "signup";
  const submitDisabled =
    consentState.isLoading ||
    consentState.isError ||
    !consentState.canProceed ||
    isSubmitting ||
    isExpired;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(1,131,255,0.08),_transparent_55%)]"
        aria-hidden
      />

      <div className="relative w-full max-w-[600px] rounded-3xl border border-gray-border bg-white/95 p-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <button
          type="button"
          onClick={returnToLogin}
          aria-label="로그인으로 돌아가기"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-dark-gray outline-none ring-offset-2 transition hover:bg-bubble-gray/80 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <BrandLogo variant="combination" size="M" alt="우때 로고" />
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                {isSignup ? "서비스 약관 동의" : "변경된 약관 재동의"}
              </h1>
              <p className="mt-2 text-[17px] leading-relaxed text-dark-gray">
                {isSignup
                  ? "가입을 완료하려면 필수 약관에 동의해 주세요."
                  : "계속 이용하려면 변경된 필수 약관에 다시 동의해 주세요."}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="w-full rounded-xl border border-primary/35 bg-primary/[0.06] px-4 py-3 text-left"
            >
              <p className="text-[17px] font-medium text-primary">
                {errorMessage}
              </p>
              {isExpired && (
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="mt-3 text-[17px] font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Google 로그인 다시 시작하기
                </button>
              )}
            </div>
          )}

          <AgreementConsentSection onStateChange={setConsentState} />

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
            aria-disabled={submitDisabled}
            className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? "처리 중…"
              : isSignup
                ? "동의하고 가입하기"
                : "동의하고 계속하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
