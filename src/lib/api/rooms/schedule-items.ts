import { apiFetch } from "@/lib/api/client";
import {
  chunkArray,
  SCHEDULE_ROUTES_BATCH_MAX_SIZE,
} from "@/lib/api/batch-chunk";
import { apiUrl, jsonBody, requestJson, requestVoid } from "@/lib/api/http";

export type RoomScheduleItem = {
  itemId: number;
  scheduleId: number;
  googlePlaceId: string;
  /** 날짜·시간대 없는 `HH:mm`, 미설정은 `null` */
  startTime: string | null;
  /** 날짜·시간대 없는 `HH:mm`, 미설정은 `null` */
  endTime: string | null;
  memo?: string;
  orderIndex: number;
  /** 현재 항목 → 다음 항목 공유 이동수단 — 서버 DB 저장, 기본 `DRIVING` */
  travelMode: string;
  createdAt: string;
};

export type UpdateTravelModeRequest = {
  /** `DRIVING` | `WALKING` | `BICYCLING` | `TRANSIT` */
  travelMode: string;
};

export type RoomScheduleItemCreateRequest = {
  googlePlaceId: string;
  /** 로컬 시:분, 예: `"09:45"`. 미지정 시 서버는 저장하지 않음(미설정 상태) */
  startTime?: string | null;
  /** 종료를 지정하려면 시작 필요. 시작보다 이르면 다음 날, 같으면 0분 */
  endTime?: string | null;
  /** 0-based 삽입 위치. 생략하면 맨 뒤에 추가 */
  orderIndex?: number;
};

export type CreateScheduleItemResponse = {
  createdItem: RoomScheduleItem;
  /** 삽입으로 순서가 밀리거나 추천 이동수단이 변경된 기존 항목 */
  updatedItems: RoomScheduleItem[];
  affectedRouteItemIds: number[];
};

export type RoomScheduleItemUpdateRequest = {
  /** `null` 이면 미설정으로 초기화, `undefined` 는 변경 없음 */
  startTime?: string | null;
  /** `null` 이면 미설정으로 초기화, `undefined` 는 변경 없음 */
  endTime?: string | null;
  /** 키를 내면 서버가 갱신. 빈 문자열이면 삭제 */
  memo?: string | null;
};

export type ReorderScheduleItemRequest = {
  newOrderIndex: number;
};

export type MoveScheduleItemToScheduleRequest = {
  targetScheduleId: number;
  targetOrderIndex: number;
};

/** GET …/route — 현재 항목 → 다음 항목 구간 단일 레그 */
export type ScheduleItemRouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  travelMode: string;
  /** 지도 폴리라인용 Google encoded polyline — 경로에 폴리라인이 없으면 서버가 생략 */
  encodedPolyline?: string;
};

/**
 * travelMode 미지정 조회 시 본문에 수단별 배열을 함께 줄 수 있습니다.
 */
export type ScheduleItemRouteResponse = ScheduleItemRouteLeg & {
  routes?: ScheduleItemRouteLeg[];
  modeRoutes?: ScheduleItemRouteLeg[];
};

export type ScheduleItemRouteBatchRequestItem = {
  itemId: number;
  /** 생략하면 서버가 해당 항목의 저장된 공유 이동수단을 사용 */
  travelMode?: string;
};

export type ScheduleItemRouteBatchItem =
  | ({
      status: "OK";
      itemId: number;
      travelMode: string;
      distanceMeters: number;
      durationSeconds: number;
      /** 지도 폴리라인용 Google encoded polyline — 폴리라인이 없으면 서버가 생략 */
      encodedPolyline?: string;
    })
  | {
      status: "ERROR";
      itemId: number;
      travelMode: string;
      errorCode?: string;
    };

export type ScheduleItemRouteBatchResponse = {
  /** 서버 명세 — `POST …/routes/batch` */
  routes?: ScheduleItemRouteBatchItem[];
  /** 레거시·내부 호환 */
  items?: ScheduleItemRouteBatchItem[];
};

function readScheduleItemRouteBatchItems(
  data: ScheduleItemRouteBatchResponse,
): ScheduleItemRouteBatchItem[] {
  if (Array.isArray(data.routes)) return data.routes;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export async function getScheduleItemRoute(
  roomId: string,
  scheduleId: number,
  /** 구간 시작(현재) 일정 항목 ID — 명세상 ‘현재 항목에서 다음 항목으로’ */
  itemId: number,
  travelMode?: string | null,
): Promise<ScheduleItemRouteResponse | null> {
  const params = new URLSearchParams();
  const tm =
    typeof travelMode === "string" && travelMode.trim().length > 0
      ? travelMode.trim()
      : null;
  if (tm) params.set("travelMode", tm);
  const qs = params.toString();
  const path = `/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}/route${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(apiUrl(path), undefined);
  // 경로 안내 없음: 서버는 204 No Content (본문 없음)
  if (res.status === 204) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`이동 정보 조회 실패: ${res.status}`);
  }
  return res.json() as Promise<ScheduleItemRouteResponse>;
}

async function getScheduleItemRoutesBatchChunk(
  roomId: string,
  scheduleId: number,
  items: ScheduleItemRouteBatchRequestItem[],
): Promise<ScheduleItemRouteBatchItem[]> {
  const data = await requestJson<ScheduleItemRouteBatchResponse>(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/routes/batch`),
    { method: "POST", ...jsonBody({ items }) },
    { errorMessage: "이동 정보 일괄 조회 실패" },
  );
  return readScheduleItemRouteBatchItems(data);
}

export async function getScheduleItemRoutesBatch(
  roomId: string,
  scheduleId: number,
  items: readonly ScheduleItemRouteBatchRequestItem[],
): Promise<ScheduleItemRouteBatchItem[]> {
  const normalized = items
    .filter(
      (it) => typeof it.itemId === "number" && Number.isFinite(it.itemId),
    )
    .map((it) => {
      const tm =
        typeof it.travelMode === "string" && it.travelMode.trim().length > 0
          ? it.travelMode.trim()
          : null;
      return tm ? { itemId: it.itemId, travelMode: tm } : { itemId: it.itemId };
    });
  if (!normalized.length) return [];

  const chunks = chunkArray(normalized, SCHEDULE_ROUTES_BATCH_MAX_SIZE);
  const out: ScheduleItemRouteBatchItem[] = [];
  for (const chunk of chunks) {
    out.push(...(await getScheduleItemRoutesBatchChunk(roomId, scheduleId, chunk)));
  }
  return out;
}

export async function getScheduleItems(
  roomId: string,
  scheduleId: number,
): Promise<RoomScheduleItem[]> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items`),
    undefined,
    { errorMessage: "일정 장소 목록 조회 실패" },
  );
}

export async function createScheduleItem(
  roomId: string,
  scheduleId: number,
  body: RoomScheduleItemCreateRequest,
): Promise<CreateScheduleItemResponse> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items`),
    { method: "POST", ...jsonBody(body) },
    { errorMessage: "일정 장소 추가 실패" },
  );
}

export async function updateScheduleItem(
  roomId: string,
  scheduleId: number,
  itemId: number,
  body: RoomScheduleItemUpdateRequest,
): Promise<RoomScheduleItem> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}`),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "일정 항목 수정 실패" },
  );
}

export async function updateScheduleItemTravelMode(
  roomId: string,
  scheduleId: number,
  itemId: number,
  body: UpdateTravelModeRequest,
): Promise<RoomScheduleItem> {
  return requestJson(
    apiUrl(
      `/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}/travel-mode`,
    ),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "이동 수단 변경 실패" },
  );
}

export async function deleteScheduleItem(
  roomId: string,
  scheduleId: number,
  itemId: number,
): Promise<void> {
  return requestVoid(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}`),
    { method: "DELETE" },
    { errorMessage: "일정 장소 삭제 실패" },
  );
}

export async function reorderScheduleItem(
  roomId: string,
  scheduleId: number,
  itemId: number,
  body: ReorderScheduleItemRequest,
): Promise<RoomScheduleItem[]> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}/order`),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "일정 순서 변경 실패" },
  );
}

export async function moveScheduleItemToSchedule(
  roomId: string,
  sourceScheduleId: number,
  itemId: number,
  body: MoveScheduleItemToScheduleRequest,
): Promise<RoomScheduleItem> {
  return requestJson(
    apiUrl(
      `/rooms/${roomId}/schedules/${sourceScheduleId}/items/${itemId}/move`,
    ),
    { method: "PATCH", ...jsonBody(body) },
    { errorMessage: "일정 항목 이동 실패" },
  );
}
