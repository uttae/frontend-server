"use client";

import { useState } from "react";

import { CloseIcon, PlusIcon, ReactionStarIcon } from "@/assets/icons";
import { DashedBorder } from "@/components/mobile/DashedPlaceholderBox";
import { usePlaceDetailData } from "@/components/place/usePlaceDetailData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { MobileRouteExpandedShell } from "./MobileRoutePlaceCard";
import { MobileRoutePlaceDetail } from "./MobileRoutePlaceDetail";

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
  badgeColor: string;
  onAdd: () => Promise<boolean>;
  onClose: () => void;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
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
    if (!added) setAdding(false);
  }

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
        <span
          aria-hidden
          className="mt-px flex size-6 shrink-0 items-center justify-center rounded-[5.5px] border border-dashed bg-fill-subtle"
          style={{ borderColor: badgeColor, color: badgeColor }}
        >
          <PlusIcon size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {isLoading && !detail ? (
            <output aria-label="장소 정보 불러오는 중" aria-busy className="flex flex-col gap-1.5 pt-0.5">
              <Skeleton render={<span />} className="h-5 w-2/3" />
              <Skeleton render={<span />} tone="subtle" className="h-4 w-1/2" />
            </output>
          ) : (
            <>
              <h3 className="line-clamp-2 break-words text-title-s text-text">{name}</h3>
              <CandidateMetadata category={category} address={address} rating={detail?.rating} />
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

function CandidateMetadata({
  category,
  address,
  rating,
}: Readonly<{
  category: string;
  address: string;
  rating: number | null | undefined;
}>) {
  return (
    <p className="flex min-w-0 items-center gap-1 text-body-s-regular text-text-subtle">
      {category ? <span className="shrink-0">{category}</span> : null}
      {rating != null ? (
        <span className="flex shrink-0 items-center gap-0.5">
          {category ? <span aria-hidden>·</span> : null}
          <ReactionStarIcon size={14} className="fill-current text-[var(--orange-500)] [&_path]:stroke-none" />
          <span className="tabular-nums">{rating.toFixed(1)}</span>
        </span>
      ) : null}
      {address ? (
        <>
          {category || rating != null ? <span aria-hidden>·</span> : null}
          <span className="truncate">{address}</span>
        </>
      ) : null}
    </p>
  );
}
