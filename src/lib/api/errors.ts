import { MAX_SCHEDULES_PER_ROOM } from "@/lib/plan/schedulePolicy";

export const AGREEMENTS_NOT_ACCEPTED_ERROR_CODE = "AGREEMENTS_NOT_ACCEPTED";
export const AGREEMENTS_REACCEPTANCE_REQUIRED_ERROR_CODE =
  "AGREEMENTS_REACCEPTANCE_REQUIRED";
export const GOOGLE_SIGNUP_TOKEN_NOT_FOUND_ERROR_CODE =
  "GOOGLE_SIGNUP_TOKEN_NOT_FOUND";
export const GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_ERROR_CODE =
  "GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND";
export const AGREEMENT_CONFIGURATION_INVALID_ERROR_CODE =
  "AGREEMENT_CONFIGURATION_INVALID";
export const WITHDRAWAL_REQUIRES_HOST_DELEGATION_ERROR_CODE =
  "WITHDRAWAL_REQUIRES_HOST_DELEGATION";
export const INVALID_DESTINATIONS_SIZE_ERROR_CODE =
  "INVALID_DESTINATIONS_SIZE";
export const DUPLICATE_DESTINATION_ERROR_CODE = "DUPLICATE_DESTINATION";

const INVALID_DESTINATIONS_SIZE_DEFAULT_MESSAGE =
  "여행지는 1~5개까지 입력할 수 있어요.";
const DUPLICATE_DESTINATION_DEFAULT_MESSAGE =
  "같은 여행지는 중복해서 넣을 수 없어요.";

const AGREEMENTS_NOT_ACCEPTED_DEFAULT_MESSAGE =
  "필수 약관에 동의해야 서비스를 이용할 수 있습니다.";

const AGREEMENTS_REACCEPTANCE_REQUIRED_DEFAULT_MESSAGE =
  "변경된 약관에 다시 동의해 주세요.";

const GOOGLE_SIGNUP_TOKEN_NOT_FOUND_DEFAULT_MESSAGE =
  "가입 요청이 만료되었거나 다른 로그인 시도로 무효화되었습니다. 다시 로그인해 주세요.";

const GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_DEFAULT_MESSAGE =
  "재동의 요청이 만료되었거나 다른 로그인 시도로 무효화되었습니다. 다시 로그인해 주세요.";

const AGREEMENT_CONFIGURATION_INVALID_DEFAULT_MESSAGE =
  "약관 설정에 문제가 있어 가입을 진행할 수 없습니다. 잠시 후 다시 시도해 주세요.";

/** 북마크 장소 중복 시 백엔드 JSON에 실을 수 있는 `code` / `errorCode` 값 (HTTP status와 별개) */
const ROOM_BOOKMARK_DUPLICATE_ERROR_CODES = new Set<string>([
  "BOOKMARK_ALREADY_EXISTS",
  "BOOKMARK_DUPLICATE",
  "DUPLICATE_BOOKMARK",
  "ROOM_BOOKMARK_DUPLICATE",
]);

function readApiErrorCodeFromJson(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  const direct = o.code ?? o.errorCode;
  if (typeof direct === "string" && direct.length > 0) return direct.trim();
  if (typeof direct === "number" && Number.isFinite(direct))
    return String(direct);
  if (typeof o.error === "string" && o.error.length > 0) return o.error.trim();
  const nested = o.error;
  if (nested !== null && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    const c = n.code ?? n.errorCode;
    if (typeof c === "string" && c.length > 0) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return undefined;
}

export function isRoomBookmarkDuplicateFromBody(body: unknown): boolean {
  const raw = readApiErrorCodeFromJson(body);
  if (!raw) return false;
  const normalized = raw.toUpperCase().replace(/-/g, "_");
  return ROOM_BOOKMARK_DUPLICATE_ERROR_CODES.has(normalized);
}

export function isScheduleLimitExceededFromBody(body: unknown): boolean {
  const raw = readApiErrorCodeFromJson(body);
  if (!raw) return false;
  return raw.toUpperCase().replace(/-/g, "_") === "SCHEDULE_LIMIT_EXCEEDED";
}

export function readNormalizedApiErrorCode(body: unknown): string | undefined {
  const raw = readApiErrorCodeFromJson(body);
  if (!raw) return undefined;
  return raw.toUpperCase().replace(/-/g, "_");
}

export function isAgreementsNotAcceptedFromBody(body: unknown): boolean {
  return (
    readNormalizedApiErrorCode(body) === AGREEMENTS_NOT_ACCEPTED_ERROR_CODE
  );
}

export function isAgreementsReacceptanceRequiredFromBody(
  body: unknown,
): boolean {
  return (
    readNormalizedApiErrorCode(body) ===
    AGREEMENTS_REACCEPTANCE_REQUIRED_ERROR_CODE
  );
}

export function isWithdrawalRequiresHostDelegationFromBody(
  body: unknown,
): boolean {
  return (
    readNormalizedApiErrorCode(body) ===
    WITHDRAWAL_REQUIRES_HOST_DELEGATION_ERROR_CODE
  );
}

export type RoomRequiringDelegation = {
  roomId: string;
  title: string;
};

export function readRoomsRequiringDelegationFromBody(
  body: unknown,
): RoomRequiringDelegation[] {
  if (body === null || typeof body !== "object") return [];
  const raw = (body as Record<string, unknown>).roomsRequiringDelegation;
  if (!Array.isArray(raw)) return [];

  const rooms: RoomRequiringDelegation[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const roomIdRaw = o.roomId;
    const roomId =
      typeof roomIdRaw === "string"
        ? roomIdRaw.trim()
        : roomIdRaw != null
          ? String(roomIdRaw).trim()
          : "";
    const titleRaw = o.title;
    const title =
      typeof titleRaw === "string" ? titleRaw.trim() : "";
    if (!roomId.length || !title.length) continue;
    rooms.push({ roomId, title });
  }
  return rooms;
}

/** Google 로그인·약관 재동의 API 오류 JSON → 사용자 메시지 */
export function messageForGoogleLoginError(
  body: unknown,
  fallback = "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
): string {
  if (isAgreementsNotAcceptedFromBody(body)) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      AGREEMENTS_NOT_ACCEPTED_DEFAULT_MESSAGE
    );
  }
  if (isAgreementsReacceptanceRequiredFromBody(body)) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      AGREEMENTS_REACCEPTANCE_REQUIRED_DEFAULT_MESSAGE
    );
  }
  const code = readNormalizedApiErrorCode(body);
  if (code === GOOGLE_SIGNUP_TOKEN_NOT_FOUND_ERROR_CODE) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      GOOGLE_SIGNUP_TOKEN_NOT_FOUND_DEFAULT_MESSAGE
    );
  }
  if (code === GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_ERROR_CODE) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      GOOGLE_REACCEPTANCE_TOKEN_NOT_FOUND_DEFAULT_MESSAGE
    );
  }
  if (code === AGREEMENT_CONFIGURATION_INVALID_ERROR_CODE) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      AGREEMENT_CONFIGURATION_INVALID_DEFAULT_MESSAGE
    );
  }
  return readUserFacingMessageFromApiBody(body) ?? fallback;
}

/** 약관 재동의 API 오류 JSON → 사용자 메시지 */
export function messageForAgreementsAcceptError(
  body: unknown,
  fallback = "약관 동의 처리에 실패했습니다.",
): string {
  return messageForGoogleLoginError(body, fallback);
}

/** `SCHEDULE_LIMIT_EXCEEDED` 등 — 서버 메시지에 30개 상한을 덧붙입니다. */
export function withScheduleLimitCountHint(
  message: string | undefined,
  body?: unknown,
): string {
  const base = message?.trim() || "최대 일정 개수를 초과했어요.";
  const isLimit =
    (body !== undefined && isScheduleLimitExceededFromBody(body)) ||
    /최대\s*일정|일정.*(초과|개수)|SCHEDULE_LIMIT/i.test(base);
  if (!isLimit) return base;
  if (base.includes(String(MAX_SCHEDULES_PER_ROOM))) return base;
  return `${base} (방당 최대 ${MAX_SCHEDULES_PER_ROOM}개까지예요.)`;
}

/** HTTP error JSON에서 사용자에게 그대로 보여줄 메시지 추출 (Spring `message` / `errors` 등) */
export function readUserFacingMessageFromApiBody(
  body: unknown,
): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const o = body as Record<string, unknown>;
  const detail = o.message ?? o.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  const nested = o.error;
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    const nm = n.message;
    if (typeof nm === "string" && nm.trim()) return nm.trim();
  }
  const errors = o.errors;
  if (errors !== null && typeof errors === "object" && !Array.isArray(errors)) {
    for (const v of Object.values(errors as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v)) {
        const first = v.find((x) => typeof x === "string" && x.trim());
        if (typeof first === "string") return first.trim();
      }
    }
  }
  return undefined;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

/** 방 생성·수정 API의 여행지 관련 서버 에러(HTTP 4xx) → 한국어 사용자 메시지 */
export function messageForRoomDestinationError(
  body: unknown,
  fallback: string,
): string {
  const code = readNormalizedApiErrorCode(body);
  if (code === INVALID_DESTINATIONS_SIZE_ERROR_CODE) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      INVALID_DESTINATIONS_SIZE_DEFAULT_MESSAGE
    );
  }
  if (code === DUPLICATE_DESTINATION_ERROR_CODE) {
    return (
      readUserFacingMessageFromApiBody(body) ??
      DUPLICATE_DESTINATION_DEFAULT_MESSAGE
    );
  }
  return readUserFacingMessageFromApiBody(body) ?? fallback;
}

/** 북마크 카테고리명 중복(HTTP 409) 시 토스트용 문구 */
export function messageForBookmarkCategorySaveError(
  e: unknown,
  fallback: string,
): string {
  if (e instanceof HttpError && e.status === 409) {
    return "이미 존재하는 북마크명입니다";
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
