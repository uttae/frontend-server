import { useIsFetching } from "@tanstack/react-query";

import { useStompContext } from "@/contexts/StompContext";
import { roomSchedulesQueryKey } from "@/lib/query-keys";

/**
 * 연결이 끊긴 동안이나 놓친 변경을 다시 받는 동안 — 이때 보이는 일정 순서는 서버와 다를 수 있다.
 * 재정렬 API는 절대 위치만 받으므로 이 구간에는 순서를 바꾸지 않는다.
 */
export function useScheduleResyncPending(roomId: string): boolean {
  const { connected } = useStompContext();
  const rid = roomId.trim();
  const isResyncing =
    useIsFetching({ queryKey: roomSchedulesQueryKey(rid || null), exact: true }) > 0;
  return !connected || isResyncing;
}
