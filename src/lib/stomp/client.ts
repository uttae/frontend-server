import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { clientEnv } from "@/lib/client-env";

export const STOMP_MAX_RECONNECT_DELAY_MS = 30_000;

export const STOMP_MAX_RECONNECT_ATTEMPTS = 7;

export function getStompBrokerURL(): string {
  return `${clientEnv.NEXT_PUBLIC_API_BASE_URL}/ws`;
}

export function createStompClient(httpURL: string): Client {
  return new Client({
    webSocketFactory: () => new SockJS(httpURL),
    reconnectDelay: 1_000 + Math.random() * 1_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    maxReconnectDelay: STOMP_MAX_RECONNECT_DELAY_MS,
  });
}
