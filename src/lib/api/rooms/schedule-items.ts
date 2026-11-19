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
  startTime: string | null;
  endTime: string | null;
  memo?: string;
  orderIndex: number;
  travelMode: string;
  createdAt: string;
};

export type UpdateTravelModeRequest = {
  travelMode: string;
};

export type RoomScheduleItemCreateRequest = {
  googlePlaceId: string;
  startTime?: string | null;
  endTime?: string | null;
  orderIndex?: number;
};

export type CreateScheduleItemResponse = {
  createdItem: RoomScheduleItem;
  updatedItems: RoomScheduleItem[];
  affectedRouteItemIds: number[];
};

export type RoomScheduleItemUpdateRequest = {
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
};

export type ReorderScheduleItemRequest = {
  newOrderIndex: number;
};

export type MoveScheduleItemToScheduleRequest = {
  targetScheduleId: number;
  targetOrderIndex: number;
};

export type ScheduleItemRouteLeg = {
  distanceMeters: number;
  durationSeconds: number;
  travelMode: string;
  encodedPolyline?: string;
};

export type ScheduleItemRouteResponse = ScheduleItemRouteLeg & {
  routes?: ScheduleItemRouteLeg[];
  modeRoutes?: ScheduleItemRouteLeg[];
};

export type ScheduleItemRouteBatchRequestItem = {
  itemId: number;
  travelMode?: string;
};

export type ScheduleItemRouteBatchItem =
  | ({
      status: "OK";
      itemId: number;
      toItemId?: number;
      travelMode: string;
      distanceMeters: number;
      durationSeconds: number;
      encodedPolyline?: string;
    })
  | {
      status: "ERROR";
      itemId: number;
      toItemId?: number;
      travelMode: string;
      errorCode?: string;
    };

export type ScheduleItemRouteBatchResponse = {
  routes?: ScheduleItemRouteBatchItem[];
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
  itemId: number,
  destinationItemId: number,
  travelMode?: string | null,
): Promise<ScheduleItemRouteResponse | null> {
  const params = new URLSearchParams({ destinationItemId: String(destinationItemId) });
  const tm =
    typeof travelMode === "string" && travelMode.trim().length > 0
      ? travelMode.trim()
      : null;
  if (tm) params.set("travelMode", tm);
  const qs = params.toString();
  const path = `/rooms/${roomId}/schedules/${scheduleId}/items/${itemId}/route${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(apiUrl(path), undefined);
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
  signal?: AbortSignal,
): Promise<RoomScheduleItem[]> {
  return requestJson(
    apiUrl(`/rooms/${roomId}/schedules/${scheduleId}/items`),
    { signal },
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
