import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";

import { expireClientSessionAndRedirect } from "@/lib/auth-session-client";
import { fetchSessionUserRaw } from "@/lib/session-user";
import { setSessionUserCache } from "@/lib/session-user-cache";

/** 백엔드 access 만료 시 WebSocket close code (분기·로깅 참고용) */
export const STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE = 4001;

/** 세션 확인이 응답 없이 매달리면 재연결 시도 전체가 멈추므로 시간을 제한한다 */
const SESSION_PROBE_TIMEOUT_MS = 5_000;

export type SessionProbeOutcome = "authenticated" | "unauthorized" | "transient";

export type SessionProbeResult = {
  outcome: SessionProbeOutcome;
};

export type RefreshSessionBeforeReconnectOptions = {
  client: Client;
  queryClient: QueryClient;
  /** 세션 확인을 기다리는 동안 연결이 정리됐는지(로그아웃·경로 이탈) */
  isActive: () => boolean;
};

/**
 * `GET /api/auth/session` — 200 / 401 / transient(503·네트워크·시간 초과·기타) 분기.
 */
export async function probeClientSession(): Promise<SessionProbeResult> {
  if (typeof window === "undefined") {
    return { outcome: "transient" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 200) {
      return { outcome: "authenticated" };
    }
    if (res.status === 401) {
      return { outcome: "unauthorized" };
    }
    return { outcome: "transient" };
  } catch {
    return { outcome: "transient" };
  } finally {
    clearTimeout(timeout);
  }
}

async function syncSessionUserCache(queryClient: QueryClient): Promise<void> {
  try {
    const user = await fetchSessionUserRaw();
    if (user) {
      setSessionUserCache(queryClient, user);
    }
  } catch {
    // session 200이면 STOMP 재연결은 진행
  }
}

/** session 갱신 실패 — 클라이언트 세션 정리 및 로그인 이동 */
export function handleStompSessionExpired(queryClient: QueryClient): void {
  expireClientSessionAndRedirect({ queryClient });
}

/**
 * stompjs `beforeConnect`에서 재연결 직전에 부릅니다.
 * `/api/auth/session`이 쿠키를 갱신해, access 만료(4001) 뒤 만료된 쿠키로 다시 붙지 않게 합니다.
 * 재시도 간격은 stompjs가 맡으므로 한 번만 확인합니다. 안에서 부르는 함수는 예외를 던지지 않습니다.
 * stompjs는 `beforeConnect` 예외를 잡지 않아 던지면 재연결이 멈추기 때문입니다.
 */
export async function refreshSessionBeforeReconnect({
  client,
  queryClient,
  isActive,
}: RefreshSessionBeforeReconnectOptions): Promise<void> {
  const probe = await probeClientSession();
  if (!isActive()) {
    return;
  }

  if (probe.outcome === "unauthorized") {
    await client.deactivate();
    handleStompSessionExpired(queryClient);
    return;
  }

  if (probe.outcome === "authenticated") {
    // 다른 탭에서 계정이 바뀌었으면 여기서 세션 사용자 캐시가 새 사용자로 바뀐다
    await syncSessionUserCache(queryClient);
  }
  // transient면 그대로 연결을 시도한다. 실패하면 stompjs가 다음 간격에 다시 부른다
}
