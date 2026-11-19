import type { QueryClient } from "@tanstack/react-query";

import { tearDownClientSession } from "@/lib/client-storage";
import { getQueryClient } from "@/lib/query-client";

function shouldRedirectToLoginFromPath(pathname: string): boolean {
  if (pathname === "/login") return false;
  if (pathname.startsWith("/join/")) return false;
  if (pathname.startsWith("/auth/")) return false;
  return true;
}

export function expireClientSessionAndRedirect(options?: {
  queryClient?: QueryClient;
}): void {
  const queryClient = options?.queryClient ?? getQueryClient() ?? undefined;
  tearDownClientSession({ queryClient });

  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (!shouldRedirectToLoginFromPath(path)) return;
  window.location.replace("/login");
}
