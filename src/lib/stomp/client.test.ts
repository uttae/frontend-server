import { ReconnectionTimeMode } from "@stomp/stompjs";
import { describe, expect, it } from "vitest";

import {
  createStompClient,
  STOMP_MAX_RECONNECT_DELAY_MS,
} from "@/lib/stomp/client";

describe("createStompClient", () => {
  it("delegates reconnecting to stompjs with a capped exponential backoff", () => {
    const client = createStompClient("http://fixture.invalid/ws");

    expect(client.reconnectTimeMode).toBe(ReconnectionTimeMode.EXPONENTIAL);
    expect(client.maxReconnectDelay).toBe(STOMP_MAX_RECONNECT_DELAY_MS);
    expect(client.reconnectDelay).toBeGreaterThanOrEqual(1_000);
    expect(client.reconnectDelay).toBeLessThan(2_000);
  });
});
