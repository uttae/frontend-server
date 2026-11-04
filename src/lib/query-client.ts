import { QueryClient } from "@tanstack/react-query";

import { isNetworkError } from "@/lib/api/errors";

let registeredQueryClient: QueryClient | null = null;

/** 일시적 네트워크 오류만 한 번 더 보낸다 — Google 429도 백엔드에서 502로 오므로 HTTP 오류는 재시도하지 않는다 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && isNetworkError(error);
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
    },
  });
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
