import type { Client } from "@stomp/stompjs";

const SESSION_PRESENCE_PING_INTERVAL_MS = 30_000;

export function startSessionPresencePing(client: Client): () => void {
  let id: ReturnType<typeof setInterval> | null = null;

  const send = () => {
    if (!client.connected) return;
    client.publish({
      destination: "/app/ping",
      headers: { "content-type": "application/json" },
      body: JSON.stringify("ping"),
    });
  };

  send();
  id = setInterval(() => {
    if (!client.connected) {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
      return;
    }
    send();
  }, SESSION_PRESENCE_PING_INTERVAL_MS);

  return () => {
    if (id != null) {
      clearInterval(id);
      id = null;
    }
  };
}
