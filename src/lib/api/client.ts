import { authenticatedFetch } from "@/lib/api/authenticated-fetch";
import { expireClientSessionAndRedirect } from "@/lib/auth-session-client";
import { fetchSessionUserRaw } from "@/lib/auth";
import { getQueryClient } from "@/lib/query-client";
import {
  readSessionUserCache,
  setSessionUserCache,
} from "@/lib/session-user-cache";
import { getTabId } from "@/lib/tab-id";

const CLIENT_TAB_ID_HEADER = "X-Client-Tab-Id";

function withClientTabIdHeader(init: RequestInit | undefined): RequestInit | undefined {
  const tabId = getTabId();
  if (!tabId || !init) return init;

  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const isPreflighted =
    method === "PATCH" ||
    method === "PUT" ||
    method === "DELETE" ||
    (method === "POST" &&
      (headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json"));
  if (!isPreflighted) return init;

  headers.set(CLIENT_TAB_ID_HEADER, tabId);
  return { ...init, headers };
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const { response: res, didRefresh } = await authenticatedFetch(
    input,
    withClientTabIdHeader(init),
  );

  if (res.status === 401) {
    expireClientSessionAndRedirect({
      queryClient: getQueryClient() ?? undefined,
    });
    return res;
  }

  if (didRefresh) {
    const queryClient = getQueryClient();
    if (queryClient && readSessionUserCache(queryClient) == null) {
      const user = await fetchSessionUserRaw();
      if (user) setSessionUserCache(queryClient, user);
    }
  }

  return res;
}
