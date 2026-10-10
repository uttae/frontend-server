"use client";

import { useState } from "react";

import { CloseIcon, PlusIcon, ReactionStarIcon } from "@/assets/icons";
import { DashedBorder } from "@/components/mobile/DashedPlaceholderBox";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { cn } from "@/lib/utils";

import { MobileRouteExpandedShell } from "./MobileRoutePlaceCard";
import { MobileRoutePlaceDetail } from "./MobileRoutePlaceDetail";

/**
 * 경로 보기에서 지도의 Google 장소를 누르면 카드 줄의 넣을 자리(고른 카드 바로 뒤)에 끼우는 후보 카드.
 * 일정 장소 카드와 같은 배치(배지·이름·분류)를 쓰되, 아직 넣지 않은 장소라 점선 테두리와 "+" 배지로 구분한다.
 * 카드를 누르면 다른 경로 카드처럼 사진·홈·리뷰 상세로 펼친다.
 */
export function MobileRouteCandidateCard({
  googlePlaceId,
  badgeColor,
  onAdd,
  onClose,
  expanded,
  onExpand,
  onCollapse,
  detailActive,
}: Readonly<{
  googlePlaceId: string;
  /** 넣을 일차 색 */
  badgeColor: string;
  /** 추가에 성공하면 true — 실패하면 카드를 남겨 다시 누를 수 있게 한다 */
  onAdd: () => Promise<boolean>;
  onClose: () => void;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  /** 가운데 카드일 때만 펼친 상세를 불러온다 */
  detailActive: boolean;
}>) {
  const { data: detail, isLoading } = usePlaceDetailData(googlePlaceId);
  const [adding, setAdding] = useState(false);
  const name = detail?.name?.trim() || "장소";
  const category = detail?.primaryTypeDisplayName?.trim() ?? "";
  const address = detail?.formattedAddress?.trim() ?? "";

  async function handleAdd() {
    if (adding) return;
    setAdding(true);
    const added = await onAdd();
    // 성공하면 카드가 사라지므로 실패했을 때만 되돌린다
    if (!added) setAdding(false);
  }

  // 접힌 카드는 넘겨 보는 줄 높이(가장 긴 카드)를 채우고, 정보는 위·추가 버튼은 아래에 붙인다
  const card = (
    <div className={cn("relative", !expanded && "h-full")}>
      {expanded ? null : (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`후보 장소 ${name} 상세 보기`}
          className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-primary-strong"
        />
      )}
      <div className="pointer-events-none relative flex h-full gap-3 pb-4 pl-3.5 pr-2 pt-3">
        {/* 순번 자리 — 아직 순번이 없어 일차 색 점선 배지에 "+" */}
        <span
          aria-hidden
          className="mt-px flex size-6 shrink-0 items-center justify-center rounded-[5.5px] border border-dashed bg-fill-subtle"
          style={{ borderColor: badgeColor, color: badgeColor }}
        >
          <PlusIcon size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {isLoading && !detail ? (
            <div
              role="status"
              aria-label="장소 정보 불러오는 중"
              aria-busy
              className="flex flex-col gap-1.5 pt-0.5"
            >
              <span className="h-5 w-2/3 animate-pulse rounded bg-fill-strong" />
              <span className="h-4 w-1/2 animate-pulse rounded bg-fill" />
            </div>
          ) : (
            <>
              <h3 className="line-clamp-2 break-words text-title-s text-text">
                {name}
              </h3>
              <p className="flex min-w-0 items-center gap-1 text-body-s-regular text-text-subtle">
                {category ? <span className="shrink-0">{category}</span> : null}
                {detail?.rating != null ? (
                  <span className="flex shrink-0 items-center gap-0.5">
                    {category ? <span aria-hidden>·</span> : null}
                    <ReactionStarIcon
                      size={14}
                      className="fill-current text-[var(--orange-500)] [&_path]:stroke-none"
                    />
                    <span className="tabular-nums">
                      {detail.rating.toFixed(1)}
                    </span>
                  </span>
                ) : null}
                {address ? (
                  <>
                    {category || detail?.rating != null ? (
                      <span aria-hidden>·</span>
                    ) : null}
                    <span className="truncate">{address}</span>
                  </>
                ) : null}
              </p>
            </>
          )}
          <div className="mt-auto pt-3.5">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={adding}
              className="pointer-events-auto flex h-9 w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-primary text-label-m-emphasis text-text-inverse disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled"
            >
              <PlusIcon size={16} className="shrink-0" />이 자리에 추가
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="후보 장소 닫기"
          className="pointer-events-auto -mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center"
        >
          <CloseIcon size={20} className="text-icon-subtle" />
        </button>
      </div>
    </div>
  );

  if (!expanded) {
    return (
      // 다른 장소 카드와 같은 배경에 점선 테두리만 달리해 아직 넣지 않은 자리임을 보인다
      <div className="relative h-full rounded-md bg-fill-subtle">
        <DashedBorder active className="inset-[0.5px] size-[calc(100%-1px)]" />
        {card}
      </div>
    );
  }

  return (
    <MobileRouteExpandedShell onCollapse={onCollapse} tentative>
      {card}
      <MobileRoutePlaceDetail
        place={{
          googlePlaceId,
          title: name,
          subtitle: address || undefined,
          location: detail?.location ?? undefined,
          primaryTypeDisplayName: category || undefined,
        }}
        active={detailActive}
        analyticsSource="map"
      />
    </MobileRouteExpandedShell>
  );
}
