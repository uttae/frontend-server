import { expect, it, vi } from "vitest";
import { toast } from "sonner";
import { dispatchUserError } from "./user-error-dispatch";
import { parseUserErrorMessage } from "./user-error-events";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

it("accepts AI_DISABLED without suggesting a retry", () => {
  const payload = parseUserErrorMessage(JSON.stringify({
    domain: "MESSAGE", action: "SEND", code: "AI_DISABLED",
    clientRequestId: "client-1", retryable: false,
    message: "이 환경에서는 AI 기능을 제공하지 않습니다",
  }));
  expect(payload).not.toBeNull();
  if (!payload) throw new Error("Expected the existing error contract to parse");
  dispatchUserError(payload);
  expect(toast.error).toHaveBeenCalledExactlyOnceWith(
    "이 환경에서는 AI 기능을 제공하지 않습니다",
    { duration: 4500 },
  );
});
