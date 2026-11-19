"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { usePathname } from "next/navigation";

import { AnalyticsRouteTracker } from "@/components/analytics/AnalyticsRouteTracker";
import { GoogleMapsProvider } from "@/components/google-maps-provider";
import { StompProvider } from "@/contexts/StompContext";
import { reconcileClientSession } from "@/lib/auth";
import { beginClientSessionReconciliationTransition } from "@/lib/auth-session";
import { getOrCreateQueryClient } from "@/lib/query-client";
import { AppChromeShell } from "@/providers/app-chrome-shell";
import { useSessionStore } from "@/stores/session-store";

function SessionReconciler() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const previousPathname = useRef<string | null>(null);

  useLayoutEffect(() => {
    previousPathname.current =
      beginClientSessionReconciliationTransition({
        previousPathname: previousPathname.current,
        pathname,
        markSessionPending: () =>
          useSessionStore.getState().setSessionReady(false),
        reconcile: () => {
          void reconcileClientSession(queryClient);
        },
      });
  }, [pathname, queryClient]);

  return null;
}

export function FullAppProviderStack({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getOrCreateQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionReconciler />
      <StompProvider>
        <GoogleMapsProvider>
          <AppChromeShell analytics={<AnalyticsRouteTracker />}>
            {children}
          </AppChromeShell>
        </GoogleMapsProvider>
      </StompProvider>
      {process.env.NEXT_PUBLIC_RQ_DEVTOOLS === "1" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
