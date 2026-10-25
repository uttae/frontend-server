import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { clientEnv } from "@/lib/client-env";

/** 재연결 간격 상한. 기존 오프라인 재시도 간격(세션 확인 5초)에 맞춘다 */
export const STOMP_MAX_RECONNECT_DELAY_MS = 5_000;

/**
 * NEXT_PUBLIC_API_BASE_URL 기반으로 SockJS HTTP URL을 반환합니다.
 * 백엔드가 .withSockJS()로 설정되어 있으므로 ws:// 대신 http:// 를 사용합니다.
 */
export function getStompBrokerURL(): string {
  return `${clientEnv.NEXT_PUBLIC_API_BASE_URL}/ws`;
}

/** 끊기면 stompjs가 지수 간격(1→2→4…초, 상한 5초)으로 다시 연결한다 */
export function createStompClient(httpURL: string): Client {
  return new Client({
    webSocketFactory: () => new SockJS(httpURL),
    // 시작 간격을 탭마다 1~2초로 흩어, 함께 끊긴 탭들이 같은 순간 다시 붙지 않게 한다
    reconnectDelay: 1_000 + Math.random() * 1_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    maxReconnectDelay: STOMP_MAX_RECONNECT_DELAY_MS,
  });
}
