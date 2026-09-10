/** 플랜 화면에서 쓰는 장소 한 건 — 서버 일정 항목과 매핑 가능 */
export type PlanPlace = {
  id: string;
  title: string;
  /** 짧은 부제 또는 긴 설명(여러 줄) */
  subtitle?: string;
  /** preview API `primaryTypeDisplayName` — 카드 타입 라벨 */
  primaryTypeDisplayName?: string;
  /** 레거시·폴백: 이미 해석된 미리보기 URL */
  imageUrl?: string;
  /** 서버 일정 항목과 매핑 시 */
  itemId?: number;
  googlePlaceId?: string;
  /** `GET /places/{id}/preview` 성공 시 — 지도 마커·경로 표시용 */
  location?: { lat: number; lng: number };
  /** 서버 일정 항목 — PATCH 시 사용 (`HH:mm` 등 API 그대로) */
  startTime?: string | null;
  endTime?: string | null;
  /** 서버 저장 공유 이동수단(`schedule_items.travel_mode`) — PATCH `…/travel-mode`로 변경, 기본 `DRIVING` */
  travelMode?: string;
  /** 일정 항목 메모 — PATCH로만 설정 */
  memo?: string;
};

/** 일차별 플랜 메타 — 섹션 헤더용 (`places`는 현재 빈 배열) */
export type PlanDayData = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  places: PlanPlace[];
};
