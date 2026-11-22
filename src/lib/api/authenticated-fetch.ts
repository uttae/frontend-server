import { tryClientRefresh } from "@/lib/api/auth";

export type AuthenticatedFetchResult = {
  response: Response;
  didRefresh: boolean;
};

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<AuthenticatedFetchResult> {
  const opts: RequestInit = { credentials: "include", ...init };
  const res = await fetch(input, opts);

  if (res.status !== 401) {
    return { response: res, didRefresh: false };
  }

  const refreshed = await tryClientRefresh();
  if (!refreshed) {
    return { response: res, didRefresh: false };
  }

  return {
    response: await fetch(input, opts),
    didRefresh: true,
  };
}
