"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { AnonymousAnalyticsRouteTracker } from "@/components/analytics/AnonymousAnalyticsRouteTracker";
import { LandingSectionTracker } from "@/components/analytics/LandingSectionTracker";
import { AppChromeShell } from "@/providers/app-chrome-shell";

const PROVIDER_FREE_PUBLIC_PATHS = new Set(["/", "/login"]);

const FullAppProviderStack = dynamic(() =>
  import("@/providers/full-app-provider-stack").then(
    (module) => module.FullAppProviderStack,
  ),
);

function LightweightPublicShell({ children }: { children: ReactNode }) {
  return (
    <AppChromeShell analytics={<AnonymousAnalyticsRouteTracker />}>
      {children}
    </AppChromeShell>
  );
}

export function AppRootProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };

    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  return <>
    <LandingSectionTracker />
    {PROVIDER_FREE_PUBLIC_PATHS.has(pathname)
      ? <LightweightPublicShell>{children}</LightweightPublicShell>
      : <FullAppProviderStack>{children}</FullAppProviderStack>}
  </>;
}
