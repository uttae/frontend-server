import {
  QueryClient,
  type InvalidateOptions,
  type InvalidateQueryFilters,
  type Query,
} from "@tanstack/react-query";

import { isNetworkError } from "@/lib/api/errors";

let registeredQueryClient: QueryClient | null = null;

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

export function registerQueryClient(client: QueryClient): void {
  registeredQueryClient = client;
}

export function getQueryClient(): QueryClient | null {
  return registeredQueryClient;
}

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
  if (queryClient.getQueryCache().findAll(firstLoads).length > 0) {
    await queryClient.cancelQueries(firstLoads);
  }
  await queryClient.invalidateQueries(filters, options);
}
