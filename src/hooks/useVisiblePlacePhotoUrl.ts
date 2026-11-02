import { useState } from "react";

/**
 * 다시 받아도 불러오지 못한 사진 주소는 그리지 않는다 — 깨진 이미지 대신 각 카드의 '사진 없음' 모양을 보인다.
 * 주소가 바뀌면(다시 받은 주소가 다르면) 다시 그린다.
 */
export function useVisiblePlacePhotoUrl(url: string | null | undefined) {
  const [unavailableUrl, setUnavailableUrl] = useState<string | null>(null);
  const visibleUrl = url && url !== unavailableUrl ? url : null;
  return {
    visibleUrl,
    markUnavailable: () => setUnavailableUrl(visibleUrl),
  };
}
