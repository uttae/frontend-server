export type UserErrorPayload = {
  action: string;
  clientRequestId: string;
  code: string;
  domain: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number | null;
};

export function parseUserErrorMessage(body: string): UserErrorPayload | null {
  try {
    const raw = JSON.parse(body) as Record<string, unknown>;
    const action = raw?.action;
    const clientRequestId = raw?.clientRequestId;
    const code = raw?.code;
    const domain = raw?.domain;
    const message = raw?.message;
    const retryable = raw?.retryable;
    const retryAfterMsRaw = raw?.retryAfterMs;
    if (
      typeof action !== "string" ||
      typeof clientRequestId !== "string" ||
      typeof code !== "string" ||
      typeof domain !== "string" ||
      typeof message !== "string" ||
      typeof retryable !== "boolean"
    ) {
      return null;
    }
    let retryAfterMs: number | null | undefined;
    if (retryAfterMsRaw === null) {
      retryAfterMs = null;
    } else if (retryAfterMsRaw !== undefined) {
      if (typeof retryAfterMsRaw !== "number" || retryAfterMsRaw < 0) {
        return null;
      }
      retryAfterMs = retryAfterMsRaw;
    }
    return {
      action,
      clientRequestId,
      code,
      domain,
      message,
      retryable,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
  } catch {
    return null;
  }
}

export function isMessageRateLimit(payload: UserErrorPayload): boolean {
  if (payload.domain !== "MESSAGE") return false;
  if (payload.action === "RATE_LIMITED") return true;
  if (payload.action === "SEND" && payload.retryAfterMs != null) return true;
  return false;
}

export function getRateLimitRetryAfterMs(payload: UserErrorPayload): number {
  if (payload.retryAfterMs != null && payload.retryAfterMs > 0) {
    return payload.retryAfterMs;
  }
  if (payload.action === "RATE_LIMITED") return 5000;
  return 0;
}
