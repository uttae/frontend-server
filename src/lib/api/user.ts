import { apiFetch } from "@/lib/api/client";
import {
  isWithdrawalRequiresHostDelegationFromBody,
  readRoomsRequiringDelegationFromBody,
  readUserFacingMessageFromApiBody,
  type RoomRequiringDelegation,
} from "@/lib/api/errors";
import { apiUrl, requestVoid, tryParseJson } from "@/lib/api/http";

export type { RoomRequiringDelegation };

export async function completeTutorial(): Promise<void> {
  await requestVoid(
    apiUrl("/users/me/tutorial/complete"),
    { method: "POST" },
    { errorMessage: "튜토리얼 완료 상태를 저장하지 못했습니다" },
  );
}

export type WithdrawAccountResult =
  | { ok: true }
  | {
      ok: false;
      kind: "host_delegation_required";
      rooms: RoomRequiringDelegation[];
    }
  | { ok: false; kind: "error"; status: number; message?: string };

export async function withdrawAccount(): Promise<WithdrawAccountResult> {
  const res = await apiFetch(apiUrl("/users/me"), { method: "DELETE" });

  if (res.status === 204) {
    return { ok: true };
  }

  const body = await tryParseJson(res);

  if (res.status === 422 && isWithdrawalRequiresHostDelegationFromBody(body)) {
    return {
      ok: false,
      kind: "host_delegation_required",
      rooms: readRoomsRequiringDelegationFromBody(body),
    };
  }

  return {
    ok: false,
    kind: "error",
    status: res.status,
    message: readUserFacingMessageFromApiBody(body) ?? "회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  };
}
