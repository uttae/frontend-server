"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode, useState } from "react";

import { LoginErrorAlert } from "@/app/login/login-error-alert";
import { BrandLogo } from "@/components/BrandLogo";
import {
  buildGoogleAuthorizationUrl,
  clearGoogleAgreementFlowSession,
  messageForOAuthLoginErrorParam,
  saveOAuthPendingSession,
} from "@/lib/google-oauth";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-bubble-gray/80 via-white to-white px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(1,131,255,0.08),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-[600px] rounded-3xl border border-gray-border bg-white/95 p-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <Link
          href="/"
          aria-label="우때 홈으로 돌아가기"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-dark-gray outline-none ring-offset-2 transition hover:bg-bubble-gray/80 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <BrandLogo variant="combination" size="M" alt="우때 로고" />
            <p className="text-[17px] leading-relaxed text-dark-gray">
              로그인하고 여행 계획을 이어가세요!
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const [dismissedErrorCode, setDismissedErrorCode] = useState<string | null>(
    null,
  );
  const errorMessage =
    dismissedErrorCode === oauthErrorCode
      ? null
      : messageForOAuthLoginErrorParam(oauthErrorCode);

  const clearError = () => setDismissedErrorCode(oauthErrorCode);

  const handleContinueWithGoogle = () => {
    clearGoogleAgreementFlowSession();
    const state = crypto.randomUUID();
    saveOAuthPendingSession({ state });
    window.location.href = `${buildGoogleAuthorizationUrl()}&state=${state}`;
  };

  return (
    <LoginShell>
      {errorMessage && (
        <LoginErrorAlert message={errorMessage} onDismiss={clearError} />
      )}
      <button
        type="button"
        onClick={handleContinueWithGoogle}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-border bg-white px-4 py-3 text-lg font-medium text-[#1f1f1f] shadow-sm transition hover:bg-bubble-gray/60 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleMark className="h-5 w-5 shrink-0" />
        <span>Google로 계속하기</span>
      </button>
    </LoginShell>
  );
}

export function LoginFallback() {
  return (
    <LoginShell>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="flex w-full cursor-wait items-center justify-center gap-3 rounded-xl border border-gray-border bg-white px-4 py-3 text-lg font-medium text-[#1f1f1f] opacity-70 shadow-sm"
      >
        <GoogleMark className="h-5 w-5 shrink-0" />
        <span>Google로 계속하기</span>
      </button>
    </LoginShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
