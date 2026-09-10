import type {
  AcceptAgreementsRequest,
  CurrentAgreementsResponse,
} from "@/lib/agreements/types";
import { apiFetch } from "@/lib/api/client";
import { messageForAgreementsAcceptError } from "@/lib/api/errors";
import { apiUrl, jsonBody, tryParseJson } from "@/lib/api/http";

export type {
  AcceptAgreementsRequest,
  AgreementItem,
  AgreementType,
  AgreementContentFormat,
  CurrentAgreementsResponse,
} from "@/lib/agreements/types";

/**
 * 현행 약관 목록 조회.
 * BFF `GET /api/agreements/current` — 로그인·재동의 화면 공용.
 */
export async function fetchCurrentAgreements(): Promise<CurrentAgreementsResponse> {
  const res = await fetch("/api/agreements/current", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error("약관을 불러오지 못했습니다.");
  }

  return res.json() as Promise<CurrentAgreementsResponse>;
}

const ACCEPT_AGREEMENTS_BODY: AcceptAgreementsRequest = {
  agreementsAccepted: true,
};

/**
 * 인증 사용자 약관 재동의.
 * `POST /api/users/me/agreements` — 204 No Content 시 성공.
 */
export async function acceptUserAgreements(): Promise<void> {
  const res = await apiFetch(apiUrl("/api/users/me/agreements"), {
    method: "POST",
    ...jsonBody(ACCEPT_AGREEMENTS_BODY),
  });

  if (res.status === 204 || res.ok) {
    return;
  }

  const body = await tryParseJson(res);
  throw new Error(messageForAgreementsAcceptError(body));
}
