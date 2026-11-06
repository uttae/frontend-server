import type { QueryClient } from "@tanstack/react-query";

import { readSessionUserId } from "@/lib/session-user-cache";
import { getTabId } from "@/lib/tab-id";

type ChangeOrigin = {
  actorUserId: number;
  /** 변경 요청의 `X-Client-Tab-Id`. 헤더를 싣기 전 백엔드나 HTTP 밖의 변경이면 없다 */
  originTabId?: string | null;
};

/**
 * 이 탭이 보낸 변경의 반향인지 판정한다 — 반향이면 그 탭의 mutation이 이미 캐시를 맞춘다.
 * `originTabId`가 없으면 예전처럼 계정으로 판정해, 같은 계정의 다른 탭도 반향으로 본다.
 */
export function isOwnEcho(queryClient: QueryClient, event: ChangeOrigin): boolean {
  if (event.originTabId) return event.originTabId === getTabId();
  const me = readSessionUserId(queryClient);
  return typeof me === "number" && Number.isFinite(me) && me === event.actorUserId;
}
