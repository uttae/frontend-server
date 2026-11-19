"use client";

import { MapPinIconWithoutCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

import { MAP_PIN_DISPLAY_SIZE_PX, mapPinBodyBorderProps } from "./map-pin-stroke";

export type PlanItineraryStopMapPinProps = {
  orderLabel: number;
  pinColor?: string;
  emphasized?: boolean;
  className?: string;
};

export function PlanItineraryStopMapPin({
  orderLabel,
  pinColor,
  emphasized = false,
  className,
}: PlanItineraryStopMapPinProps) {
  const twoDigits = orderLabel >= 10;
  const trimmed = typeof pinColor === "string" ? pinColor.trim() : "";

  return (
    <span
      className={cn(
        "relative inline-block",
        trimmed.length === 0 && "text-primary",
        className,
      )}
    >
      <span className={cn("relative block origin-bottom drop-shadow-md", emphasized && "scale-[1.3]")}>
        <MapPinIconWithoutCircle
          size={MAP_PIN_DISPLAY_SIZE_PX}
          color={trimmed.length > 0 ? trimmed : "currentColor"}
          {...mapPinBodyBorderProps}
        />
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 font-semibold tabular-nums leading-none tracking-tight text-white",
            twoDigits ? "text-body-s-regular mobile:text-body-xs-regular" : "text-body-l-regular mobile:text-body-m-regular",
          )}
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.42)" }}
          aria-hidden
        >
          {orderLabel}
        </span>
      </span>
    </span>
  );
}
