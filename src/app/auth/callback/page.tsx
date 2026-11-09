"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AuthFlowSpinner } from "@/components/auth/AuthFlowSpinner";
import { exchangeGoogleCode } from "@/lib/api/auth";
import {
  consumeOAuthPendingSession,
  loginErrorQueryForExchangeFailure,
  saveGoogleAgreementFlowSession,
} from "@/lib/google-oauth";
import { pendingInviteAuthPath } from "@/lib/session-user-flow";
import { finishGoogleLogin } from "@/lib/google-login-client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // React Strict Mode (Next dev) 에서 useEffect 가 두 번 실행되면
  // sessionStorage 의 pendingInviteCode/oauth_pending 가 첫 실행에서 비워져
  // 두 번째 실행이 home/login 으로 잘못 리다이렉트한다. 코드 교환도 1회만 시도.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const pending = consumeOAuthPendingSession();

    if (
      !code ||
      !returnedState ||
      !pending ||
      returnedState !== pending.state
    ) {
      router.replace(pendingInviteAuthPath("/login?error=OAuthCallback"));
      return;
    }

    exchangeGoogleCode(code, pending.agreementsAccepted)
      .then(async (result) => {
        if (result.ok && result.status === "AUTHENTICATED") {
          const destination = await finishGoogleLogin(queryClient);
          router.replace(destination ?? pendingInviteAuthPath("/login?error=OAuthCallback"));
          return;
        }

        if (result.ok && result.status === "SIGNUP_REQUIRED") {
          saveGoogleAgreementFlowSession({
            kind: "signup",
            signupToken: result.signupToken,
            expiresAt: Date.now() + result.expiresInSeconds * 1000,
          });
          router.replace(pendingInviteAuthPath("/login/agreements"));
          return;
        }

        if (result.ok && result.status === "REACCEPTANCE_REQUIRED") {
          saveGoogleAgreementFlowSession({
            kind: "reaccept",
            reacceptanceToken: result.reacceptanceToken,
            expiresAt: Date.now() + result.expiresInSeconds * 1000,
          });
          router.replace(pendingInviteAuthPath("/login/agreements"));
          return;
        }

        const errorQuery = loginErrorQueryForExchangeFailure(result.errorCode);
        router.replace(pendingInviteAuthPath(`/login?error=${errorQuery}`));
      })
      .catch(() => {
        router.replace(pendingInviteAuthPath("/login?error=OAuthCallback"));
      });
  }, [searchParams, router, queryClient]);

  return <AuthFlowSpinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthFlowSpinner />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
