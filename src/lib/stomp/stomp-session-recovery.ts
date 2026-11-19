import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "@stomp/stompjs";

import { expireClientSessionAndRedirect } from "@/lib/auth-session-client";
import { fetchSessionUserRaw } from "@/lib/session-user";
import { setSessionUserCache } from "@/lib/session-user-cache";

export const STOMP_ACCESS_TOKEN_EXPIRED_CLOSE_CODE = 4001;

const SESSION_PROBE_TIMEOUT_MS = 5_000;

export type SessionProbeOutcome = "authenticated" | "unauthorized" | "transient";

export type SessionProbeResult = {
  outcome: SessionProbeOutcome;
};

export type RefreshSessionBeforeReconnectOptions = {
  client: Client;
  queryClient: QueryClient;
  isActive: () => boolean;
};

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
  } catch {}
}

export function handleStompSessionExpired(queryClient: QueryClient): void {
  expireClientSessionAndRedirect({ queryClient });
}

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
    await syncSessionUserCache(queryClient);
  }
}
