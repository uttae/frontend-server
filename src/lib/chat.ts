import { pickProfileImageUrl } from "@/lib/api/profileImage";
import type { RoomMember } from "@/lib/api/rooms";
import { stripRecommendedPlaceReasonPrefix } from "@/lib/recommended-place-reason";
import type {
  AiConversationSummaryPayload,
  AiPlaceRecommendationHeading,
  AiRecommendedPlace,
  AiRequestStatus,
  ChatMessage,
  PlaceShareData,
  ServerChatMessage,
  ServerChatMessageType,
} from "@/types/chat";


const ALLOWED: ReadonlySet<string> = new Set([
  "CHAT",
  "AI_REQUEST",
  "AI_RESPONSE",
  "PLACE_SHARE",
  "SYSTEM",
  "AI",
]);

/** STOMP/REST 공통 — 공백·대소문자 정규화 */
export function normalizeMessageKind(
  raw: ServerChatMessageType | unknown,
): string {
  if (raw == null) return "CHAT";
  if (typeof raw !== "string") return "CHAT";
  const t = raw.trim();
  if (!t) return "CHAT";
  return t.toUpperCase();
}

export function coerceServerChatMessageType(
  raw: unknown,
): ServerChatMessageType {
  const k = normalizeMessageKind(raw as ServerChatMessageType);
  return ALLOWED.has(k) ? (k as ServerChatMessageType) : "CHAT";
}

function readNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** REST/STOMP 페이로드에서 senderId · 멤버 매칭용 숫자 정규화 */
export function parseFiniteNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeMetadataRecord(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" && Number.isFinite(val))
      out[k] = String(val);
    else if (typeof val === "boolean") out[k] = val ? "true" : "false";
    else if (val !== null && typeof val === "object")
      out[k] = JSON.stringify(val);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * `/topic/rooms/{id}/messages` · GET /messages 공통 페이로드 정규화
 * (camelCase/snake_case, senderId 숫자·문자열)
 */
export function normalizeServerChatMessage(
  raw: unknown,
): ServerChatMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const id = readNonEmptyString(r.id);
  const roomId = readNonEmptyString(r.roomId ?? r.room_id);
  if (!id || !roomId) return null;

  const messageType = coerceServerChatMessageType(
    r.messageType ?? r.message_type,
  );

  const createdAt =
    typeof r.createdAt === "string"
      ? r.createdAt
      : typeof r.created_at === "string"
        ? r.created_at
        : "";

  const senderId =
    parseFiniteNumber(r.senderId ?? r.sender_id) ?? 0;

  const clientMessageId =
    typeof r.clientMessageId === "string"
      ? r.clientMessageId
      : typeof r.client_message_id === "string"
        ? r.client_message_id
        : undefined;

  const metadata = normalizeMetadataRecord(r.metadata);

  const sequence = parseFiniteNumber(r.sequence ?? r.seq);

  return {
    id,
    roomId,
    senderId,
    messageType,
    createdAt,
    clientMessageId,
    metadata,
    ...(typeof r.content === "string" ? { content: r.content } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
  };
}

export type AiResponseStructuredShape = {
  intent?: string;
  answerText?: string;
  recommendedPlaces?: ChatMessage["aiRecommendedPlaces"];
  placeRecommendationHeading?: ChatMessage["aiPlaceRecommendationHeading"];
  conversationSummary?: ChatMessage["aiConversationSummary"];
};

/** parseAiResponseStructuredMeta 결과에서 말풍선 확장 필드만 추출 */
export function aiResponseStructuredToPartialFields(
  structured: AiResponseStructuredShape,
): Partial<
  Pick<
    ChatMessage,
    | "aiIntent"
    | "aiRecommendedPlaces"
    | "aiPlaceRecommendationHeading"
    | "aiConversationSummary"
  >
> {
  const fields: Partial<
    Pick<
      ChatMessage,
      | "aiIntent"
      | "aiRecommendedPlaces"
      | "aiPlaceRecommendationHeading"
      | "aiConversationSummary"
    >
  > = {};

  if (structured.intent) fields.aiIntent = structured.intent;

  if (
    structured.intent === "place_recommendation" &&
    structured.recommendedPlaces?.length
  ) {
    fields.aiRecommendedPlaces = structured.recommendedPlaces;
    if (structured.placeRecommendationHeading) {
      fields.aiPlaceRecommendationHeading =
        structured.placeRecommendationHeading;
    }
  }

  if (
    structured.intent === "conversation_summary" &&
    structured.conversationSummary
  ) {
    fields.aiConversationSummary = structured.conversationSummary;
  }

  return fields;
}

export function aiResponseDisplayText(
  content: string,
  structured: Pick<AiResponseStructuredShape, "answerText">,
): string {
  const t = structured.answerText?.trim();
  return t != null && t !== "" ? t : content;
}

function readMetaString(
  meta: Record<string, string> | undefined,
  ...keys: string[]
): string | undefined {
  if (!meta) return undefined;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return undefined;
}

function safeParseJson<T>(raw: string | undefined): T | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return v;
    }
  }
  return undefined;
}

function parseOneRecommendedPlace(raw: unknown): AiRecommendedPlace | null {
  if (!isRecord(raw)) return null;
  const placeId =
    (
      pickString(
        raw.placeId,
        raw.place_id,
        raw.googlePlaceId,
        raw.google_place_id,
      ) ?? ""
    ).trim();
  const name = (pickString(raw.name) ?? "").trim();
  const lat = parseFiniteNumber(raw.lat ?? raw.latitude);
  const lng = parseFiniteNumber(raw.lng ?? raw.longitude);
  if (!placeId || !name || lat === undefined || lng === undefined)
    return null;
  const address =
    pickString(raw.address, raw.formattedAddress, raw.formatted_address) ??
    "";
  const reasonRaw = pickString(raw.reason);
  let reasonOut: string | undefined;
  if (reasonRaw !== undefined) {
    const t = stripRecommendedPlaceReasonPrefix(reasonRaw, placeId).trim();
    if (t.length > 0) reasonOut = t;
  }
  const primaryType = pickString(raw.primaryType, raw.primary_type);
  const googleMapsUri = pickString(
    raw.googleMapsUri,
    raw.google_maps_uri,
  );
  const rating = parseFiniteNumber(
    raw.rating ?? raw.userRating ?? raw.user_rating,
  );
  const userRatingCountRaw = parseFiniteNumber(
    raw.userRatingCount ??
      raw.user_rating_count ??
      raw.reviewCount ??
      raw.review_count ??
      raw.userRatingsTotal ??
      raw.user_ratings_total,
  );
  const userRatingCount =
    userRatingCountRaw !== undefined &&
    Number.isFinite(userRatingCountRaw) ?
      Math.max(0, Math.round(userRatingCountRaw))
    : undefined;

  return {
    placeId,
    name,
    address,
    lat,
    lng,
    ...(rating !== undefined && Number.isFinite(rating) ? { rating } : {}),
    ...(userRatingCount !== undefined ? { userRatingCount } : {}),
    ...(primaryType ? { primaryType } : {}),
    ...(reasonOut ? { reason: reasonOut } : {}),
    ...(googleMapsUri ? { googleMapsUri } : {}),
  };
}

/** 레거시 — 메타 최상위 `recommendedPlaces` JSON 배열만 */
function parseLegacyFlatRecommendedPlaces(
  meta: Record<string, string> | undefined,
): AiRecommendedPlace[] | undefined {
  const rawStr = readMetaString(
    meta,
    "recommendedPlaces",
    "recommended_places",
    "recommendPlaces",
  );
  const parsed =
    rawStr !== undefined ?
      safeParseJson<unknown>(rawStr)
    : undefined;
  if (!Array.isArray(parsed)) return undefined;
  const out: AiRecommendedPlace[] = [];
  for (const row of parsed) {
    const p = parseOneRecommendedPlace(row);
    if (p) out.push(p);
  }
  return out.length > 0 ? out : undefined;
}

/** 제목·부제·장소 목록 — 블록 우선, 목록만 레거시 폴백 */
function parsePlaceRecommendationFromMeta(
  meta: Record<string, string> | undefined,
): {
  places?: AiRecommendedPlace[];
  heading?: AiPlaceRecommendationHeading;
} {
  const rawStr = readMetaString(
    meta,
    "place_recommendation",
    "placeRecommendation",
  );
  let blockPlaces: AiRecommendedPlace[] | undefined;
  let heading: AiPlaceRecommendationHeading | undefined;

  if (rawStr !== undefined) {
    const parsed = safeParseJson<unknown>(rawStr);
    if (isRecord(parsed)) {
      const title = pickString(parsed.title)?.trim();
      const subtitle = pickString(parsed.subtitle)?.trim();
      if (title || subtitle) {
        heading = {
          ...(title ? { title } : {}),
          ...(subtitle ? { subtitle } : {}),
        };
      }
      const placesRaw = parsed.places;
      if (Array.isArray(placesRaw)) {
        const out: AiRecommendedPlace[] = [];
        for (const row of placesRaw) {
          const p = parseOneRecommendedPlace(row);
          if (p) out.push(p);
        }
        if (out.length > 0) blockPlaces = out;
      }
    }
  }

  const legacy = parseLegacyFlatRecommendedPlaces(meta);
  const places =
    blockPlaces?.length ?
      blockPlaces
    : legacy?.length ?
      legacy
    : undefined;

  return {
    ...(places ? { places } : {}),
    ...(heading ? { heading } : {}),
  };
}

function parseSections(
  raw: unknown,
): NonNullable<AiConversationSummaryPayload["sections"]> {
  if (!Array.isArray(raw)) return [];
  const sections: NonNullable<AiConversationSummaryPayload["sections"]> = [];
  for (const row of raw) {
    if (!isRecord(row)) continue;
    const title = pickString(row.title)?.trim();
    const typeRaw = row.type;
    const type =
      typeof typeRaw === "string" ? typeRaw.trim() : `${typeRaw ?? ""}`;
    if (!title || type === "") continue;
    const itemsRaw = row.items;
    const items: string[] =
      Array.isArray(itemsRaw) ?
        itemsRaw.filter((it): it is string => typeof it === "string")
      : [];
    sections.push({ type, title, items });
  }
  return sections;
}

function parseConversationSummaryPayload(
  raw: unknown,
): AiConversationSummaryPayload | undefined {
  if (!isRecord(raw)) return undefined;
  const title = pickString(raw.title)?.trim();
  const overview = pickString(raw.overview)?.trim();
  if (!title || !overview) return undefined;
  const sections = parseSections(raw.sections);

  const payload: AiConversationSummaryPayload = {
    title,
    overview,
    ...(sections.length > 0 ? { sections } : {}),
  };
  return payload;
}

function parseConversationSummaryFromMeta(
  meta: Record<string, string> | undefined,
): AiConversationSummaryPayload | undefined {
  const rawStr = readMetaString(
    meta,
    "conversationSummary",
    "conversation_summary",
  );
  const parsed =
    rawStr !== undefined ?
      safeParseJson<unknown>(rawStr)
    : undefined;
  if (parsed == null) return undefined;
  return parseConversationSummaryPayload(parsed);
}

export function parseAiResponseStructuredMeta(metadata: Record<
  string,
  string
> | undefined): {
  intent?: string;
  answerText?: string;
  recommendedPlaces?: AiRecommendedPlace[];
  placeRecommendationHeading?: AiPlaceRecommendationHeading;
  conversationSummary?: AiConversationSummaryPayload;
} {
  if (!metadata) return {};
  const intentRaw = readMetaString(metadata, "intent", "Intent");
  const intent =
    intentRaw != null && intentRaw.trim() !== "" ?
      intentRaw.trim().toLowerCase()
    : undefined;

  const answerRaw = readMetaString(metadata, "answer_text", "answerText");
  const answerText =
    answerRaw != null && answerRaw.trim() !== "" ?
      answerRaw.trim()
    : undefined;

  const pr = parsePlaceRecommendationFromMeta(metadata);
  const recommendedPlaces = pr.places;

  const conversationSummary =
    parseConversationSummaryFromMeta(metadata);

  return {
    ...(intent ? { intent } : {}),
    ...(answerText ? { answerText } : {}),
    ...(recommendedPlaces?.length ? { recommendedPlaces } : {}),
    ...(pr.heading ? { placeRecommendationHeading: pr.heading } : {}),
    ...(conversationSummary ? { conversationSummary } : {}),
  };
}

const ALLOWED_AI_STATUS = new Set<string>(["QUEUED", "PROCESSING", "CANCELED"]);

function normalizeAiStatus(raw: string | undefined): AiRequestStatus | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const u = raw.trim().toUpperCase();
  return ALLOWED_AI_STATUS.has(u) ? (u as AiRequestStatus) : undefined;
}

function parseCancelable(meta: Record<string, string>): boolean {
  const v = meta.cancelable ?? meta.Cancelable;
  if (v === undefined) return false;
  return v === "true" || v === "1";
}

/**
 * 서버 메시지 id를 취소 STOMP `requestMessageId`로 쓸 수 있도록 정규화된 UI 메타.
 * `metadata.aiStatus`가 없으면 `aiStatus`만 생략(구 메시지).
 */
export function parseAiRequestUiMeta(
  msg: ServerChatMessage,
): {
  requestMessageId: string;
  aiStatus?: AiRequestStatus;
  cancelable: boolean;
  canceledBy?: number;
} | null {
  if (normalizeMessageKind(msg.messageType) !== "AI_REQUEST") return null;
  const meta = msg.metadata;
  if (!meta) {
    return {
      requestMessageId: msg.id,
      cancelable: false,
    };
  }
  const aiStatus = normalizeAiStatus(meta.aiStatus ?? meta.aistatus);
  const cancelable = parseCancelable(meta);
  const canceledByRaw = meta.canceledBy ?? meta.canceled_by;
  const canceledBy = parseFiniteNumber(canceledByRaw);

  return {
    requestMessageId: msg.id,
    ...(aiStatus !== undefined ? { aiStatus } : {}),
    cancelable,
    ...(canceledBy !== undefined ? { canceledBy } : {}),
  };
}

/** AI_RESPONSE 메타의 `requestMessageId` — 완료된 AI_REQUEST(서버 메시지 id) 식별 */
export function parseAiResponseRequestMessageId(
  msg: ServerChatMessage,
): string | undefined {
  const kind = normalizeMessageKind(msg.messageType);
  if (kind !== "AI_RESPONSE" && kind !== "AI") return undefined;
  const meta = msg.metadata;
  if (!meta) return undefined;
  const raw =
    meta.requestMessageId ??
    meta.request_message_id ??
    meta.requestmessageid;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** `toUiMessage` 멤버 매칭용 — 훅에서 room members 로 구축 */
export type ChatMemberMap = Map<
  number,
  Pick<RoomMember, "nickname" | "profileImageUrl">
>;

/** 방 멤버 GET 성공 시, 목록에 없는 타인 발신자 표시용 */
export const CHAT_UNKNOWN_SENDER_LABEL = "(알 수 없음)" as const;

function lookupMemberNickname(
  memberMap: ChatMemberMap,
  userIdRaw: string | undefined,
): string {
  const uid = parseFiniteNumber(userIdRaw);
  if (uid === undefined) return CHAT_UNKNOWN_SENDER_LABEL;
  const nick = memberMap.get(uid)?.nickname?.trim();
  return nick && nick.length > 0 ? nick : CHAT_UNKNOWN_SENDER_LABEL;
}

/** SYSTEM metadata.eventType + 멤버 맵 lookup으로 표시 문구 조립 */
export function formatSystemEventMessage(
  metadata: Record<string, string> | undefined,
  memberMap: ChatMemberMap,
): string {
  const eventType = readMetaString(metadata, "eventType", "event_type");
  if (!eventType) return "";

  switch (eventType) {
    case "MEMBER_JOINED":
      return `${lookupMemberNickname(memberMap, readMetaString(metadata, "userId", "user_id"))}님이 입장했어요`;
    case "MEMBER_LEFT":
      return `${lookupMemberNickname(memberMap, readMetaString(metadata, "userId", "user_id"))}님이 방을 나갔어요`;
    case "MEMBER_KICKED":
      return `${lookupMemberNickname(memberMap, readMetaString(metadata, "userId", "user_id"))}님이 추방되었어요`;
    case "HOST_DELEGATED":
      return `방장이 ${lookupMemberNickname(memberMap, readMetaString(metadata, "newHostUserId", "new_host_user_id"))}님으로 변경되었어요`;
    default:
      return "";
  }
}

export type AiRequestReplyLookupEntry = { anchorId: string; quotePreview: string };

function senderNotInRoomFromMemberMap(
  roomMembersResolved: boolean,
  memberMap: ChatMemberMap,
  senderUserId: number | undefined,
  isMine: boolean,
): boolean {
  if (!roomMembersResolved || isMine) return false;
  if (senderUserId === undefined) return false;
  return !memberMap.has(senderUserId);
}

function resolveChatDisplayAvatarUrl(
  memberProfileUrl: string | null | undefined,
  metaAvatar: string | null,
): string | undefined {
  if (
    typeof memberProfileUrl === "string" &&
    memberProfileUrl.trim().length > 0
  ) {
    return memberProfileUrl.trim();
  }
  if (metaAvatar != null && metaAvatar.trim().length > 0) {
    return metaAvatar.trim();
  }
  return undefined;
}

function formatQuotePreview(content: string, maxLen = 96): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine || "질문";
  return `${oneLine.slice(0, maxLen).trimEnd()}…`;
}

/** AI 요청 상태는 대기(QUEUED)에서 처리(PROCESSING)나 취소(CANCELED)로만 바뀐다 */
function aiRequestStatusRank(msg: ServerChatMessage): number | undefined {
  if (normalizeMessageKind(msg.messageType) !== "AI_REQUEST") return undefined;
  const status = normalizeAiStatus(msg.metadata?.aiStatus ?? msg.metadata?.aistatus);
  if (status === undefined) return undefined;
  return status === "QUEUED" ? 0 : 1;
}

/**
 * 같은 id는 나중에 받은 것(b)을 쓴다. AI 요청만은 대기 상태로 되돌리지 않는다 —
 * 상태가 바뀌기 전에 서버가 만든 조회 응답이 실시간으로 받은 처리·취소 상태를 덮지 않게.
 */
function preferNewerServerMessage(
  a: ServerChatMessage,
  b: ServerChatMessage,
): ServerChatMessage {
  const before = aiRequestStatusRank(a);
  const after = aiRequestStatusRank(b);
  return before !== undefined && after !== undefined && after < before ? a : b;
}

/** 커서 판단용 방별 sequence 순서. sequence가 없는 옛 메시지는 작성 시각으로 비교한다 */
function compareBySequence(
  x: ServerChatMessage,
  y: ServerChatMessage,
): number {
  if (x.sequence != null && y.sequence != null) return x.sequence - y.sequence;
  return x.createdAt.localeCompare(y.createdAt);
}

/**
 * 같은 id는 하나만 유지하고 작성 시각 순으로 정렬한다.
 * 거의 동시에 저장된 메시지는 서버가 충돌을 재시도한 순서로 sequence를 받아 보낸 순서와 다를 수 있다.
 */
export function mergeServerMessageLists(
  ...lists: ServerChatMessage[][]
): ServerChatMessage[] {
  const map = new Map<string, ServerChatMessage>();
  for (const list of lists) {
    for (const m of list) {
      const prev = map.get(m.id);
      if (!prev) {
        map.set(m.id, m);
        continue;
      }
      map.set(m.id, preferNewerServerMessage(prev, m));
    }
  }
  return [...map.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

/** 목록에 이미 있는 id만 새 내용으로 바꾼다. 새 id는 붙이지 않는다 */
export function replaceExistingServerMessages(
  list: ServerChatMessage[],
  updates: readonly ServerChatMessage[],
): ServerChatMessage[] {
  if (updates.length === 0) return list;
  const byId = new Map<string, ServerChatMessage>();
  for (const m of updates) {
    const prev = byId.get(m.id);
    byId.set(m.id, prev ? preferNewerServerMessage(prev, m) : m);
  }
  let changed = false;
  const next = list.map((m) => {
    const update = byId.get(m.id);
    if (!update) return m;
    const kept = preferNewerServerMessage(m, update);
    if (kept !== m) changed = true;
    return kept;
  });
  return changed ? next : list;
}

export type LiveMessagePartition = {
  /** 커서 다음 번호부터 이어지는 새 메시지 — 목록 끝에 붙인다 */
  appended: ServerChatMessage[];
  /** 이미 반영한 번호거나 중간 창에서 받은 메시지 — 목록에 있는 id만 바꾼다 */
  updates: ServerChatMessage[];
  cursor: number | undefined;
  /** 커서 다음 번호가 비었다 — 서버에서 따라잡아야 한다 */
  hasGap: boolean;
};

/**
 * 실시간 메시지를 sequence 커서로 나눈다. 커서는 목록 끝까지 빠짐없이 반영한 마지막 번호다.
 * - 목록이 최신 끝이 아니면(중간 창) 새 메시지를 붙이지 않는다. 붙이면 그 사이가 빈다
 * - 커서+1만 붙이고, 그보다 큰 번호는 빈 번호를 따라잡을 때 함께 받는다
 * - sequence가 없는 옛 메시지는 id로만 판단한다
 */
export function partitionLiveMessages(
  msgs: readonly ServerChatMessage[],
  {
    cursor,
    atTail,
    list,
  }: {
    cursor: number | undefined;
    atTail: boolean;
    list: readonly ServerChatMessage[];
  },
): LiveMessagePartition {
  const appended: ServerChatMessage[] = [];
  const updates: ServerChatMessage[] = [];
  let next = cursor;
  let hasGap = false;
  for (const msg of [...msgs].sort(compareBySequence)) {
    const seq = msg.sequence;
    if (!atTail) {
      updates.push(msg);
    } else if (seq == null || next == null) {
      if (list.some((m) => m.id === msg.id)) {
        updates.push(msg);
      } else {
        appended.push(msg);
        if (seq != null) next = seq;
      }
    } else if (seq <= next) {
      updates.push(msg);
    } else if (seq === next + 1) {
      appended.push(msg);
      next = seq;
    } else {
      hasGap = true;
    }
  }
  return { appended, updates, cursor: next, hasGap };
}

/**
 * 최신 끝까지 받은 스냅샷의 커서. 빈 방은 0(첫 메시지가 1번)이고,
 * sequence가 없는 옛 메시지뿐이면 커서를 둘 수 없다.
 */
export function tailCursorOf(
  snapshot: readonly ServerChatMessage[],
): number | undefined {
  return snapshot.length === 0 ? 0 : maxSequenceInMessages(snapshot);
}

/** GET /messages (페이징) 응답 행 → 토픽과 동일한 `ServerChatMessage[]` */
export function normalizeFetchedRoomMessages(
  rows: readonly unknown[],
): ServerChatMessage[] {
  return rows.map(
    (row) => normalizeServerChatMessage(row) ?? (row as ServerChatMessage),
  );
}

/** `beforeId` 커서 — 목록 중 `createdAt`이 가장 이른 메시지 */
export function oldestServerMessageByCreatedAt(
  msgs: ServerChatMessage[],
): ServerChatMessage | null {
  if (msgs.length === 0) return null;
  let oldest = msgs[0]!;
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.createdAt.localeCompare(oldest.createdAt) < 0) oldest = m;
  }
  return oldest;
}

/** 목록 중 `createdAt`이 가장 늦은 메시지 */
export function newestServerMessageByCreatedAt(
  msgs: ServerChatMessage[],
): ServerChatMessage | null {
  if (msgs.length === 0) return null;
  let newest = msgs[0]!;
  for (let i = 1; i < msgs.length; i++) {
    const m = msgs[i]!;
    if (m.createdAt.localeCompare(newest.createdAt) > 0) newest = m;
  }
  return newest;
}

/** 목록 중 최대 sequence (gap 추적용). 없으면 undefined */
export function maxSequenceInMessages(
  msgs: readonly ServerChatMessage[],
): number | undefined {
  let max: number | undefined;
  for (const m of msgs) {
    if (m.sequence == null) continue;
    max = max == null ? m.sequence : Math.max(max, m.sequence);
  }
  return max;
}

function buildAiRequestReplyLookup(
  rawMessages: ServerChatMessage[],
): Map<string, AiRequestReplyLookupEntry> {
  const map = new Map<string, AiRequestReplyLookupEntry>();
  for (const m of rawMessages) {
    if (normalizeMessageKind(m.messageType) !== "AI_REQUEST") continue;
    const preview = formatQuotePreview(m.content ?? "");
    const entry: AiRequestReplyLookupEntry = {
      anchorId: m.id,
      quotePreview: preview,
    };
    map.set(m.id, entry);
    const cmid =
      m.metadata?.clientMessageId?.trim() ||
      m.metadata?.client_message_id?.trim() ||
      "";
    if (cmid !== "") map.set(cmid, entry);
  }
  return map;
}

function buildFulfilledAiRequestIds(
  rawMessages: ServerChatMessage[],
): Set<string> {
  const s = new Set<string>();
  for (const m of rawMessages) {
    const reqRef = parseAiResponseRequestMessageId(m);
    if (!reqRef) continue;
    s.add(reqRef);
    for (const r of rawMessages) {
      if (normalizeMessageKind(r.messageType) !== "AI_REQUEST") continue;
      const meta = r.metadata;
      const cmid =
        meta?.clientMessageId?.trim() ||
        meta?.client_message_id?.trim() ||
        "";
      if (cmid !== "" && cmid === reqRef) {
        s.add(r.id);
      }
    }
  }
  return s;
}

/**
 * AI_REQUEST 처리 상태·답장 인용에 필요한 파생 값을 한 번에 계산
 * (`fulfilled` 집합 + 질문 미리보기 lookup).
 */
export function deriveAiRequestConversationState(rawMessages: ServerChatMessage[]): {
  fulfilledAiRequestIds: Set<string>;
  aiRequestReplyLookup: Map<string, AiRequestReplyLookupEntry>;
} {
  return {
    fulfilledAiRequestIds: buildFulfilledAiRequestIds(rawMessages),
    aiRequestReplyLookup: buildAiRequestReplyLookup(rawMessages),
  };
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function parsePlaceShareMetadata(
  metadata: Record<string, string> | undefined,
): PlaceShareData | null {
  if (!metadata) return null;
  const lat = Number(metadata.latitude);
  const lng = Number(metadata.longitude);
  const rating = Number(metadata.rating);
  const googlePlaceId = metadata.googlePlaceId ?? "";
  const name = metadata.name ?? "";
  if (!googlePlaceId || !name || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return {
    googlePlaceId,
    name,
    formattedAddress: metadata.formattedAddress ?? "",
    latitude: lat,
    longitude: lng,
    rating: Number.isNaN(rating) ? 0 : rating,
  };
}

/** 히스토리 merge 직후 등—`GET /places/photos` prefetch 입력 */
export function collectGooglePlaceIdsFromServerMessages(
  messages: ServerChatMessage[],
): string[] {
  const ids = new Set<string>();
  for (const msg of messages) {
    const kind = normalizeMessageKind(msg.messageType);
    if (kind === "PLACE_SHARE") {
      const place = parsePlaceShareMetadata(msg.metadata);
      const id =
        typeof place?.googlePlaceId === "string" ? place.googlePlaceId.trim() : "";
      if (id.length > 0) ids.add(id);
      continue;
    }
    if (kind === "AI_RESPONSE" || kind === "AI") {
      const structured = parseAiResponseStructuredMeta(msg.metadata);
      for (const rp of structured.recommendedPlaces ?? []) {
        const id = typeof rp.placeId === "string" ? rp.placeId.trim() : "";
        if (id.length > 0) ids.add(id);
      }
    }
  }
  return [...ids];
}

export function serverMessageToChatMessage(
  msg: ServerChatMessage,
  currentUserId: number | undefined,
  memberMap: ChatMemberMap,
  fulfilledAiRequestIds: ReadonlySet<string>,
  aiRequestReplyLookup: ReadonlyMap<string, AiRequestReplyLookupEntry>,
  roomMembersResolved: boolean,
): ChatMessage {
  const kind = normalizeMessageKind(msg.messageType);
  const time = formatTime(msg.createdAt) || undefined;

  if (kind === "PLACE_SHARE") {
    const place = parsePlaceShareMetadata(msg.metadata);
    const senderUserId = parseFiniteNumber(msg.senderId) ?? msg.senderId;
    const member = memberMap.get(senderUserId);
    const meta = msg.metadata;
    const metaNick =
      typeof meta?.nickname === "string"
        ? meta.nickname.trim()
        : typeof meta?.senderNickname === "string"
          ? meta.senderNickname.trim()
          : "";
    const metaAvatar =
      meta != null
        ? pickProfileImageUrl(meta as unknown as Record<string, unknown>)
        : null;
    const uid = parseFiniteNumber(currentUserId);
    const isMine = uid !== undefined && senderUserId === uid;
    const notInRoom = senderNotInRoomFromMemberMap(
      roomMembersResolved,
      memberMap,
      senderUserId,
      isMine,
    );
    const rawNick =
      member?.nickname?.trim() ||
      (metaNick.length > 0 ? metaNick : "");
    const displayNick =
      notInRoom || rawNick.length === 0 ?
        CHAT_UNKNOWN_SENDER_LABEL
      : rawNick;
    const avatar = resolveChatDisplayAvatarUrl(
      member?.profileImageUrl,
      metaAvatar,
    );

    if (place) {
      return {
        id: msg.id,
        type: "place",
        text: msg.content?.trim() || "장소 공유",
        time,
        sender: displayNick,
        senderUserId,
        avatar,
        ...(notInRoom ? { senderNotInRoom: true as const } : {}),
        place,
      };
    }
    return {
      id: msg.id,
      type: "system",
      text: msg.content?.trim() || "장소 공유",
      time,
      sender: `system:${msg.id}`,
    };
  }

  if (kind === "SYSTEM") {
    const assembled = formatSystemEventMessage(msg.metadata, memberMap);
    const legacy = msg.content?.trim() ?? "";
    return {
      id: msg.id,
      type: "system",
      text: assembled || legacy,
      time,
      sender: `system:${msg.id}`,
    };
  }

  if (kind === "AI_RESPONSE" || kind === "AI") {
    const ref = parseAiResponseRequestMessageId(msg);
    const reply = ref ? aiRequestReplyLookup.get(ref) : undefined;
    const structured = parseAiResponseStructuredMeta(msg.metadata);

    return {
      id: msg.id,
      type: "ai",
      text: aiResponseDisplayText(msg.content ?? "", structured),
      time,
      sender: "WOORI",
      ...(reply
        ? {
            aiRepliesTo: {
              requestMessageId: reply.anchorId,
              quotePreview: reply.quotePreview,
            },
          }
        : {}),
      ...aiResponseStructuredToPartialFields(structured),
    };
  }

  if (kind === "CHAT" || kind === "AI_REQUEST") {
    const senderUserId = parseFiniteNumber(msg.senderId) ?? msg.senderId;
    const member = memberMap.get(senderUserId);
    const meta = msg.metadata;
    const metaNick =
      typeof meta?.nickname === "string"
        ? meta.nickname.trim()
        : typeof meta?.senderNickname === "string"
          ? meta.senderNickname.trim()
          : "";
    const metaAvatar =
      meta != null
        ? pickProfileImageUrl(meta as unknown as Record<string, unknown>)
        : null;

    const uid = parseFiniteNumber(currentUserId);
    const isMine = uid !== undefined && senderUserId === uid;

    const notInRoom = senderNotInRoomFromMemberMap(
      roomMembersResolved,
      memberMap,
      senderUserId,
      isMine,
    );
    const rawNick =
      member?.nickname?.trim() ||
      (metaNick.length > 0 ? metaNick : "");
    const displayNick =
      notInRoom || rawNick.length === 0 ?
        CHAT_UNKNOWN_SENDER_LABEL
      : rawNick;
    const avatar = resolveChatDisplayAvatarUrl(
      member?.profileImageUrl,
      metaAvatar,
    );

    const aiReqMeta =
      kind === "AI_REQUEST" ? parseAiRequestUiMeta(msg) : null;
    const fulfilledByResponse =
      kind === "AI_REQUEST" && fulfilledAiRequestIds.has(msg.id);

    return {
      id: msg.id,
      type: isMine ? "mine" : "other",
      sender: displayNick,
      senderUserId,
      avatar,
      ...(notInRoom ? { senderNotInRoom: true as const } : {}),
      text: msg.content ?? "",
      time,
      ...(kind === "AI_REQUEST"
        ? {
            isAiRequest: true as const,
            ...(aiReqMeta
              ? {
                  aiRequest: fulfilledByResponse
                    ? {
                        requestMessageId: aiReqMeta.requestMessageId,
                        cancelable: false,
                      }
                    : aiReqMeta,
                }
              : {}),
          }
        : {}),
    };
  }

  return {
    id: msg.id,
    type: "system",
    text: msg.content ?? "",
    time,
    sender: `system:${msg.id}`,
  };
}
