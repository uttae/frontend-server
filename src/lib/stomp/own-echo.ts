import { getTabId } from "@/lib/tab-id";

type ChangeOrigin = {
  /** 변경 요청의 `X-Client-Tab-Id`. 헤더를 싣기 전 백엔드거나 탭 ID를 못 만든 탭의 변경이면 없다 */
  originTabId?: string | null;
};

/**
 * 이 탭이 보낸 변경의 반향인지 판정한다 — 반향이면 그 탭의 mutation이 이미 캐시를 맞춘다.
 * 탭 ID가 없는 이벤트는 어느 탭의 변경인지 알 수 없어, 놓치지 않도록 다른 탭의 변경으로 받는다.
 */
export function isOwnEcho(event: ChangeOrigin): boolean {
  return Boolean(event.originTabId) && event.originTabId === getTabId();
}
