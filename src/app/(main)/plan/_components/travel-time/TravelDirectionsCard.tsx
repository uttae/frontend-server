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
  /** 헤더 글리프·요약 줄에 쓰이는 수단 — 서버 저장 공유 이동수단(낙관적 선택 포함) */
  summaryMode: string;
  route: ScheduleItemRouteResponse | null | undefined;
  routeQuery: {
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  routeUnavailable: boolean;
  /** 수단별 `GET …/route` 결과 합본(저장 수단=초기·나머지=메뉴 오픈 시 패치·캐시 재사용) */
  modeRouteSummaries?: Partial<
    Record<ScheduleTravelModeValue, ScheduleItemRouteSummary>
  >;
  modeRouteRowLoading?: Partial<Record<ScheduleTravelModeValue, boolean>>;
  effectiveMode: ScheduleTravelModeValue | null;
  googleMapsDirectionsUrl?: string;
  /**
   * 둘 다 Figma Route Info 모양(이동 시간 강조·거리 회색, 길찾기는 지도 아이콘과 회색 12px)이다.
   * web은 좁은 일정 칸에서 길찾기를 다음 줄로 내리고, mobile은 Figma 모바일 간격(아이콘–정보 10)을 쓴다
   */
  variant?: "web" | "mobile";
  /** true면 목록은 참고용(클릭 선택 불가), `onSelectTravelMode` 미사용 */
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
  /** 부모 기준 현재 헤더·요약 줄에 해당하는 표준 코드(처음에는 서버, 선택 후 사용자) */
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
          // 좁은 일정 칸에서는 요약 글자를 쪼개는 대신 길찾기를 다음 줄 오른쪽으로 내린다
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
          {/* 아이콘 | 수단 | 시간·거리 세 칸을 모든 줄이 함께 써서(subgrid), 시간·거리가 가장 긴 수단 이름 뒤 오른쪽 끝에 맞춰진다 */}
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
                ) : null; // 고르지 않은 수단은 골라야 계산한다(미리 조회하지 않음)
              const rowClass = cn(
                "col-span-3 grid grid-cols-subgrid items-center rounded-md px-1.5 py-1.5 text-left text-body-s-regular mobile:text-body-xs-regular",
                !readOnly && "hover:bg-gray-border/30",
                selected &&
                  (readOnly ?
                    "bg-gray-50 ring-1 ring-gray-border/40"
                  : "bg-primary/10 ring-1 ring-primary/25"),
              );

              // 고른 수단도 다른 줄처럼 시간·거리를 보이고, 배경 강조로만 구분한다
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
