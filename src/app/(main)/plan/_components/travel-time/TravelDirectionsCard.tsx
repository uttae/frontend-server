"use client";

import { EyeOff } from "lucide-react";

import { ChevronDownIcon, MapIcon } from "@/assets/icons";
import { Spinner } from "@/components/ui/spinner";
import type { ScheduleItemRouteResponse } from "@/lib/api/rooms";
import {
  formatRouteDistance,
  formatRouteDuration,
} from "@/lib/plan/routeFormat";
import type { ScheduleItemRouteSummary } from "@/lib/plan/scheduleItemRouteModes";
import {
  SCHEDULE_TRAVEL_MODES,
  canonicalScheduleTravelMode,
  scheduleTravelModeLabel,
  type ScheduleTravelModeValue,
} from "@/lib/plan/scheduleTravelMode";
import { cn } from "@/lib/utils";

import { TravelModeGlyph } from "./TravelModeGlyph";
import { TravelRouteSummaryLine } from "./TravelRouteSummaryLine";

export type TravelDirectionsCardProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
  summaryMode: string;
  route: ScheduleItemRouteResponse | null | undefined;
  routeQuery: {
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  routeUnavailable: boolean;
  modeRouteSummaries?: Partial<
    Record<ScheduleTravelModeValue, ScheduleItemRouteSummary>
  >;
  modeRouteRowLoading?: Partial<Record<ScheduleTravelModeValue, boolean>>;
  effectiveMode: ScheduleTravelModeValue | null;
  googleMapsDirectionsUrl?: string;
  variant?: "web" | "mobile";
  readOnly?: boolean;
  onSelectTravelMode?: (next: ScheduleTravelModeValue) => void;
  onHideDirections: () => void;
};

export function TravelDirectionsCard({
  menuOpen,
  onToggleMenu,
  summaryMode,
  route,
  routeQuery,
  routeUnavailable,
  modeRouteSummaries = {},
  modeRouteRowLoading = {},
  effectiveMode,
  googleMapsDirectionsUrl,
  variant = "mobile",
  readOnly = false,
  onSelectTravelMode,
  onHideDirections,
}: TravelDirectionsCardProps) {
  const headerTravelMode =
    canonicalScheduleTravelMode(summaryMode) ?? summaryMode;

  const summaryLine = !canonicalScheduleTravelMode(summaryMode) ? "이동수단 선택" : (
    <TravelRouteSummaryLine
      route={route}
      isPending={routeQuery.isPending}
      isFetching={routeQuery.isFetching}
      isError={routeQuery.isError}
      routeUnavailable={routeUnavailable}
    />
  );

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-w-0 items-center",
          variant === "web" && "flex-wrap justify-end",
        )}
      >
        <button
          type="button"
          className={cn(
            "inline-flex min-h-10 min-w-0 grow cursor-pointer items-center gap-1.5 text-left",
            variant === "mobile" && "gap-2.5",
          )}
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <TravelModeGlyph mode={headerTravelMode} />
          <span className="inline-flex min-w-0 flex-1 items-center gap-0.5 whitespace-normal break-keep text-body-s-emphasis text-text [&_[data-route-distance]]:text-body-s-regular [&_[data-route-distance]]:text-text-subtle [&_[data-route-separator]]:mx-0.5">
            <span className="min-w-0">{summaryLine}</span>
            <ChevronDownIcon
              size={16}
              className={cn(
                "shrink-0 text-icon-subtle transition-transform",
                menuOpen && "rotate-180",
              )}
            />
          </span>
        </button>

        {googleMapsDirectionsUrl ? (
          <a
            href={googleMapsDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Google Maps에서 길찾기"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 text-body-xs-regular text-text-subtle underline-offset-2 hover:underline"
          >
            <MapIcon size={16} className="shrink-0 text-icon-subtle" />
            Google 길찾기
          </a>
        ) : null}

      </div>

      {menuOpen ? (
        <div className="w-fit max-w-full border-t border-gray-border px-2.5 py-2">
          <p className="mb-1.5 text-body-xs-emphasis font-semibold uppercase tracking-wide text-dark-gray">
            이동 수단
          </p>
          <ul
            className="grid grid-cols-[auto_auto_auto] gap-x-2 gap-y-1"
            role={readOnly ? undefined : "listbox"}
          >
            {SCHEDULE_TRAVEL_MODES.map(({ value }) => {
              const rowSummary = modeRouteSummaries[value];
              const selected = value === effectiveMode;
              const row =
                rowSummary &&
                rowSummary.durationSeconds >= 0 &&
                rowSummary.distanceMeters >= 0 ? (
                  <>
                    {formatRouteDuration(rowSummary.durationSeconds)}
                    <span className="mx-1 text-light-gray">·</span>
                    {formatRouteDistance(rowSummary.distanceMeters)}
                  </>
                ) : modeRouteRowLoading[value] ? (
                  <Spinner aria-label="이동 시간 불러오는 중" size={16} className="align-top" />
                ) : null;
              const rowClass = cn(
                "col-span-3 grid grid-cols-subgrid items-center rounded-md px-1.5 py-1.5 text-left text-body-s-regular mobile:text-body-xs-regular",
                !readOnly && "hover:bg-gray-border/30",
                selected &&
                  (readOnly ?
                    "bg-gray-50 ring-1 ring-gray-border/40"
                  : "bg-primary/10 ring-1 ring-primary/25"),
              );

              const rowValue = <span className="justify-self-end whitespace-nowrap pl-3 text-dark-gray">{row}</span>;

              if (readOnly) {
                return (
                  <li key={value} className="col-span-3 grid grid-cols-subgrid">
                    <div className={rowClass}>
                      <TravelModeGlyph mode={value} />
                      <span className="font-medium text-gray-900">
                        {scheduleTravelModeLabel(value)}
                      </span>
                      {rowValue}
                    </div>
                  </li>
                );
              }

              return (
                <li key={value} className="col-span-3 grid grid-cols-subgrid">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      rowClass,
                      "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                    onClick={() => {
                      void onSelectTravelMode?.(value);
                    }}
                  >
                    <TravelModeGlyph mode={value} />
                    <span className="font-medium text-gray-900">
                      {scheduleTravelModeLabel(value)}
                    </span>
                    {rowValue}
                  </button>
                </li>
              );
            })}

          </ul>

          <div className="my-2 border-t border-gray-border" />

          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-label-m-regular mobile:text-label-s-regular text-dark-gray hover:bg-gray-border/30"
            onClick={onHideDirections}
          >
            <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
            숨기기
          </button>
        </div>
      ) : null}
    </div>
  );
}
