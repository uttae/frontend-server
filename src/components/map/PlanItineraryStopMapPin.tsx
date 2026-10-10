"use client";

import { MapPinIconWithoutCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

import { MAP_PIN_DISPLAY_SIZE_PX, mapPinBodyBorderProps } from "./map-pin-stroke";

export type PlanItineraryStopMapPinProps = {
  /** 표시 순번 (1부터). 호출부에서 `orderIdx + 1` 전달 권장 */
  orderLabel: number;
  /** 폴리라인 일차색과 동일한 hex. 없으면 primary와 동등 */
  pinColor?: string;
  /** 경로 보기에서 카드로 고른 장소 — 핀을 살짝 키운다 */
  emphasized?: boolean;
  className?: string;
};

/**
 * 내부 원 링 없는 핀(`MapPinIconWithoutCircle`) 위에 순번을 얹어 일정 경로 정류장을 표현합니다.
 */
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
      {/* 크기는 그대로 두고 핀 끝을 기준으로 키운다(마커 기준점·순번 글자 비율도 그대로) */}
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
