import { installScheduleMemoCache } from "@/lib/plan/memo-cache";
import { QueryClient } from "@tanstack/react-query";

let registeredQueryClient: QueryClient | null = null;

export function createQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
    },
  });
  installScheduleMemoCache(client);
  return client;
}

export function getOrCreateQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  const existingClient = getQueryClient();
  if (existingClient) {
    return existingClient;
  }

  const client = createQueryClient();
  registerQueryClient(client);
  return client;
}

/** BFF·STOMP 등 React 밖에서 Query 캐시 접근용 — `AppRootProviders`에서 1회 등록 */
export function registerQueryClient(client: QueryClient): void {
  registeredQueryClient = client;
}

export function getQueryClient(): QueryClient | null {
  return registeredQueryClient;
}
