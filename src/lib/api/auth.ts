import { messageForGoogleLoginError, readNormalizedApiErrorCode } from "@/lib/api/errors";
import { tryParseJson } from "@/lib/api/http";

const FETCH_OPTS: RequestInit = {
  credentials: "include",
};

export type ExchangeGoogleCodeResult =
  | { ok: true; status: "AUTHENTICATED" }
  | {
      ok: true;
      status: "SIGNUP_REQUIRED";
      signupToken: string;
      expiresInSeconds: number;
    }
  | {
      ok: true;
      status: "REACCEPTANCE_REQUIRED";
      reacceptanceToken: string;
      expiresInSeconds: number;
    }
  | { ok: false; status: number; errorCode?: string; message?: string };

const REACCEPTANCE_DEFAULT_TTL_SECONDS = 10 * 60;

export async function exchangeGoogleCode(code: string, agreementsAccepted?: true): Promise<ExchangeGoogleCodeResult> {
  const requestBody = agreementsAccepted ? { code, agreementsAccepted: true } : { code };
  const res = await fetch("/api/auth/google", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (res.ok) {
    const body = await tryParseJson(res);
    if (body === null) return { ok: true, status: "AUTHENTICATED" };

    if (body !== null && typeof body === "object") {
      const parsed = body as Record<string, unknown>;
      if (
        parsed.status === "SIGNUP_REQUIRED" &&
        typeof parsed.signupToken === "string" &&
        parsed.signupToken.length > 0 &&
        typeof parsed.expiresInSeconds === "number" &&
        Number.isFinite(parsed.expiresInSeconds) &&
        parsed.expiresInSeconds > 0
      ) {
        return {
          ok: true,
          status: "SIGNUP_REQUIRED",
          signupToken: parsed.signupToken,
          expiresInSeconds: parsed.expiresInSeconds,
        };
      }
      if (
        parsed.status === "REACCEPTANCE_REQUIRED" &&
        typeof parsed.reacceptanceToken === "string" &&
        parsed.reacceptanceToken.length > 0
      ) {
        const rawTtl = parsed.expiresInSeconds;
        const expiresInSeconds =
          typeof rawTtl === "number" && Number.isFinite(rawTtl) && rawTtl > 0
            ? rawTtl
            : REACCEPTANCE_DEFAULT_TTL_SECONDS;
        return {
          ok: true,
          status: "REACCEPTANCE_REQUIRED",
          reacceptanceToken: parsed.reacceptanceToken,
          expiresInSeconds,
        };
      }
    }

    return {
      ok: false,
      status: res.status,
      message: "로그인 응답을 확인할 수 없습니다. 다시 시도해 주세요.",
    };
  }

  const body = await tryParseJson(res);
  const errorCode = readNormalizedApiErrorCode(body);
  const message = messageForGoogleLoginError(body);

  return {
    ok: false,
    status: res.status,
    errorCode,
    message,
  };
}

export type CompleteGoogleSignupResult =
  { ok: true } | { ok: false; status: number; errorCode?: string; message: string };

export async function completeGoogleSignup(signupToken: string): Promise<CompleteGoogleSignupResult> {
  const res = await fetch("/api/auth/google/signup", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signupToken, agreementsAccepted: true }),
  });

  if (res.ok) return { ok: true };

  const body = await tryParseJson(res);
  return {
    ok: false,
    status: res.status,
    errorCode: readNormalizedApiErrorCode(body),
    message: messageForGoogleLoginError(body, "가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."),
  };
}

export type CompleteGoogleReacceptResult =
  { ok: true } | { ok: false; status: number; errorCode?: string; message: string };

export async function completeGoogleReaccept(reacceptanceToken: string): Promise<CompleteGoogleReacceptResult> {
  const res = await fetch("/api/auth/google/reaccept", {
    ...FETCH_OPTS,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reacceptanceToken, agreementsAccepted: true }),
  });

  if (res.ok) return { ok: true };

  const body = await tryParseJson(res);
  return {
    ok: false,
    status: res.status,
    errorCode: readNormalizedApiErrorCode(body),
    message: messageForGoogleLoginError(body, "약관 재동의 처리에 실패했습니다. 잠시 후 다시 시도해 주세요."),
  };
}

async function refreshToken(): Promise<{ ok: true } | { ok: false; status: number }> {
  const res = await fetch("/api/auth/refresh", {
    ...FETCH_OPTS,
    method: "POST",
  });

  if (res.ok) return { ok: true };
  return { ok: false, status: res.status };
}

let pendingRefresh: Promise<boolean> | null = null;

export async function tryClientRefresh(): Promise<boolean> {
  if (!pendingRefresh) {
    pendingRefresh = refreshToken()
      .then((r) => r.ok)
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

export async function logout(): Promise<{ ok: true } | { ok: false; status: number }> {
  const res = await fetch("/api/auth/logout", {
    ...FETCH_OPTS,
    method: "POST",
  });

  if (res.ok) return { ok: true };
  return { ok: false, status: res.status };
}
