import type { QueryClient } from "@tanstack/react-query";

import { readSessionUserId } from "@/lib/session-user-cache";
import { getTabId } from "@/lib/tab-id";

type ChangeOrigin = {
  actorUserId: number;
  /** 변경 요청의 `X-Client-Tab-Id`. 헤더를 싣기 전 백엔드거나 탭 ID를 못 만든 탭의 변경이면 없다 */
  originTabId?: string | null;
};

/**
 * 이 탭이 보낸 변경의 반향인지 판정한다 — 반향이면 그 탭의 mutation이 이미 캐시를 맞춘다.
 * 탭 ID가 없는 이벤트는 어느 탭의 변경인지 알 수 없어, 놓치지 않도록 다른 탭의 변경으로 받는다.
 * 탭 ID는 방 멤버 모두에게 보이고 헤더로 흉내 낼 수 있어, 서버가 인증으로 정한 `actorUserId`도 나여야 반향으로 본다.
 */
export function isOwnEcho(queryClient: QueryClient, event: ChangeOrigin): boolean {
  if (!event.originTabId || event.originTabId !== getTabId()) return false;
  const me = readSessionUserId(queryClient);
  return typeof me === "number" && me === event.actorUserId;
}
