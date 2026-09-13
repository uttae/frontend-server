"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import {
  AnalyticsEvents,
  trackAnalyticsEvent,
  type AnalyticsEventParamsMap,
} from "@/lib/analytics/track";

import { cn } from "@/lib/utils";

export function LandingActionLink({
  href,
  children,
  className,
  analytics,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  analytics?: Omit<AnalyticsEventParamsMap["cta_click"], "page_type">;
}) {
  const trackActivation = (event: MouseEvent<HTMLAnchorElement>) => {
    const isActivation = event.type === "auxclick"
      ? event.button === 1
      : event.button === 0;
    if (!analytics || !isActivation) return;
    // Native click includes Enter activation. No keydown handler or navigation override.
    trackAnalyticsEvent(AnalyticsEvents.ctaClick, {
      page_type: "landing",
      ...analytics,
    });
  };

  return (
    <Link
      href={href}
      onClick={trackActivation}
      onAuxClick={trackActivation}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent bg-primary px-5 py-2.5 font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
