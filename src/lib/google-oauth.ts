import { clientEnv } from "@/lib/client-env";
import {
  AGREEMENTS_NOT_ACCEPTED_ERROR_CODE,
  AGREEMENTS_REACCEPTANCE_REQUIRED_ERROR_CODE,
} from "@/lib/api/errors";

export const GOOGLE_AUTH_CALLBACK_PATH = "/auth/callback";

export const OAUTH_PENDING_SESSION_KEY = "oauth_pending";
export const GOOGLE_AGREEMENT_FLOW_SESSION_KEY = "google_agreement_flow";

export type OAuthPendingSession = {
  state: string;
  agreementsAccepted?: true;
};

export type GoogleAgreementFlowSession =
  | {
      kind: "signup";
      signupToken: string;
      expiresAt: number;
    }
  | {
      kind: "reaccept";
      reacceptanceToken: string;
      expiresAt: number;
    };

export function saveOAuthPendingSession(pending: OAuthPendingSession): void {
  sessionStorage.setItem(OAUTH_PENDING_SESSION_KEY, JSON.stringify(pending));
}

export function consumeOAuthPendingSession(): OAuthPendingSession | null {
  const raw = sessionStorage.getItem(OAUTH_PENDING_SESSION_KEY);
  sessionStorage.removeItem(OAUTH_PENDING_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as OAuthPendingSession).state === "string" &&
      ((parsed as OAuthPendingSession).agreementsAccepted === undefined ||
        (parsed as OAuthPendingSession).agreementsAccepted === true)
    ) {
      return parsed as OAuthPendingSession;
    }
  } catch {
    return null;
  }

  return null;
}

export function saveGoogleAgreementFlowSession(
  flow: GoogleAgreementFlowSession,
): void {
  sessionStorage.setItem(
    GOOGLE_AGREEMENT_FLOW_SESSION_KEY,
    JSON.stringify(flow),
  );
}

export function readGoogleAgreementFlowSession(): GoogleAgreementFlowSession | null {
  const raw = sessionStorage.getItem(GOOGLE_AGREEMENT_FLOW_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object") return null;

    const flow = parsed as Partial<{
      kind: string;
      signupToken: string;
      reacceptanceToken: string;
      expiresAt: number;
    }>;
    if (
      flow.kind === "signup" &&
      typeof flow.signupToken === "string" &&
      flow.signupToken.length > 0 &&
      typeof flow.expiresAt === "number" &&
      Number.isFinite(flow.expiresAt)
    ) {
      return {
        kind: "signup",
        signupToken: flow.signupToken,
        expiresAt: flow.expiresAt,
      };
    }
    if (
      flow.kind === "reaccept" &&
      typeof flow.reacceptanceToken === "string" &&
      flow.reacceptanceToken.length > 0 &&
      typeof flow.expiresAt === "number" &&
      Number.isFinite(flow.expiresAt)
    ) {
      return {
        kind: "reaccept",
        reacceptanceToken: flow.reacceptanceToken,
        expiresAt: flow.expiresAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function clearGoogleAgreementFlowSession(): void {
  sessionStorage.removeItem(GOOGLE_AGREEMENT_FLOW_SESSION_KEY);
}

export function loginErrorQueryForExchangeFailure(errorCode?: string): string {
  const normalized = errorCode?.toUpperCase().replace(/-/g, "_");
  if (normalized === AGREEMENTS_NOT_ACCEPTED_ERROR_CODE) {
    return "AgreementsNotAccepted";
  }
  if (normalized === AGREEMENTS_REACCEPTANCE_REQUIRED_ERROR_CODE) {
    return "AgreementsReacceptanceRequired";
  }
  return "OAuthCallback";
}

export function resolveGoogleClientId(): string {
  return clientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

export function getGoogleOAuthRedirectUri(): string {
  return clientEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;
}

export function buildGoogleAuthorizationUrl(): string {
  const clientId = resolveGoogleClientId();
  const redirectUri = getGoogleOAuthRedirectUri();
  return (
    "https://accounts.google.com/o/oauth2/v2/auth" +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code" +
    "&scope=openid%20email%20profile"
  );
}

export function messageForOAuthLoginErrorParam(
  code: string | null,
): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    Configuration: "로그인 설정에 문제가 있습니다. 관리자에게 문의해 주세요.",
    AccessDenied: "접근이 거부되었습니다. 계정을 확인해 주세요.",
    Verification: "인증 링크가 만료되었거나 이미 사용되었습니다.",
    OAuthSignin:
      "로그인 요청을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    OAuthCallback: "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
    OAuthCreateAccount:
      "계정을 만들 수 없습니다. 다른 방법으로 로그인해 주세요.",
    Callback: "로그인 응답을 처리하지 못했습니다. 다시 시도해 주세요.",
    AgreementsNotAccepted:
      "필수 약관에 동의해야 로그인할 수 있습니다. 약관을 확인한 뒤 다시 시도해 주세요.",
    AgreementsReacceptanceRequired:
      "변경된 약관에 다시 동의해 주세요.",
    Default: "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  };
  return map[code] ?? map.Default;
}
