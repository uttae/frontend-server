import {
  QueryClient,
  type InvalidateOptions,
  type InvalidateQueryFilters,
  type Query,
} from "@tanstack/react-query";

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

/**
 * 서버 값이 바뀌었다는 알림 뒤에 다시 받는다. 받는 중인 조회는 이 변경 전에 출발했을 수 있어 취소하고 새로 받는다.
 * 데이터가 있는 조회는 무효화가 알아서 취소하지만, 데이터가 없는 첫 조회에는 TanStack이 합류해 버려서 먼저 취소한다.
 * 예: 방 입장 직후 첫 멤버 조회 중에 새 멤버가 들어오면, 그 사람이 없는 첫 응답 대신 새로 받은 목록을 쓴다.
 */
export async function invalidateAfterChange(
  queryClient: QueryClient,
  filters: InvalidateQueryFilters,
  options?: InvalidateOptions,
): Promise<void> {
  const firstLoads = {
    ...filters,
    predicate: (query: Query) =>
      query.state.data === undefined &&
      query.state.fetchStatus !== "idle" &&
      (filters.predicate?.(query) ?? true),
  };
  // 취소할 첫 조회가 없으면 기다리지 않고 바로 무효화한다 — 같은 틱의 렌더가 '받는 중'을 보게
  if (queryClient.getQueryCache().findAll(firstLoads).length > 0) {
    await queryClient.cancelQueries(firstLoads);
  }
  await queryClient.invalidateQueries(filters, options);
}
