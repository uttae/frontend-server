import { create } from "zustand";

type ChatRateLimitState = {
  message: string;
  blockedUntil: number;
};

interface ChatRateLimitStore {
  rateLimit: ChatRateLimitState | null;
  isSendBlocked: boolean;
  applyRateLimit: (message: string, retryAfterMs: number) => void;
  clearRateLimit: () => void;
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpiryTimer() {
  if (expiryTimer != null) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

function scheduleExpiry(blockedUntil: number) {
  clearExpiryTimer();
  const delay = blockedUntil - Date.now();
  if (delay <= 0) {
    useChatRateLimitStore.getState().clearRateLimit();
    return;
  }
  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    useChatRateLimitStore.getState().clearRateLimit();
  }, delay);
}

export const useChatRateLimitStore = create<ChatRateLimitStore>((set, get) => ({
  rateLimit: null,
  isSendBlocked: false,

  applyRateLimit: (message, retryAfterMs) => {
    if (retryAfterMs <= 0) return;

    const now = Date.now();
    const nextBlockedUntil = now + retryAfterMs;
    const prev = get().rateLimit;
    const blockedUntil = Math.max(prev?.blockedUntil ?? 0, nextBlockedUntil);

    set({
      rateLimit: { message, blockedUntil },
      isSendBlocked: true,
    });
    scheduleExpiry(blockedUntil);
  },

  clearRateLimit: () => {
    clearExpiryTimer();
    set({ rateLimit: null, isSendBlocked: false });
  },
}));

export function isChatSendBlocked(): boolean {
  const { rateLimit } = useChatRateLimitStore.getState();
  if (!rateLimit) return false;
  if (Date.now() >= rateLimit.blockedUntil) {
    useChatRateLimitStore.getState().clearRateLimit();
    return false;
  }
  return true;
}
