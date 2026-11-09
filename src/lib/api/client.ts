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

/**
 * 일정·북마크 STOMP 이벤트의 `originTabId`로 돌아와, 이 탭이 보낸 변경의 반향을 가려낸다.
 * 이미 CORS preflight를 하는 요청(PATCH·PUT·DELETE, JSON POST)에만 싣는다 — GET·body 없는 POST에
 * 커스텀 헤더를 붙이면 preflight가 새로 생기고, 백엔드 CORS에 maxAge가 없어 Chrome은 그 결과를 약 5초만 기억한다.
 */
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

/**
 * Drop-in replacement for fetch that automatically retries once after
 * refreshing the access token on a 401 response.
 */
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
