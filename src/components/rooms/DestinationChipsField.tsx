"use client";

import { useState } from "react";

import { CloseIcon } from "@/assets/icons";
import { DestinationSearchInput } from "@/components/search/DestinationSearchInput";
import { chipVariants } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  maxCount: number;
  maxLength: number;
};

/** 목적지 검색 칸 → 고른 칩 → 경고 순서. 여행 정보 수정(`RoomTripEditFields`)의 목적지와 같은 배치이고, 간격은 감싸는 Field가 준다 */
export function DestinationChipsField({
  values,
  onChange,
  maxCount,
  maxLength,
}: Props) {
  const [draft, setDraft] = useState("");
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);
  const atMax = values.length >= maxCount;

  function remove(index: number) {
    onChange(values.filter((_, i) => i !== index));
    setInlineWarning(null);
  }

  function handleResolved(
    place: { description: string; placeId: string } | null,
  ) {
    if (!place) return;
    const next = place.description.trim().slice(0, maxLength);
    if (!next) return;
    if (values.includes(next)) {
      setInlineWarning("이미 추가한 여행지예요");
      setDraft("");
      return;
    }
    if (values.length >= maxCount) {
      setInlineWarning(`여행지는 최대 ${maxCount}개까지 추가할 수 있어요`);
      setDraft("");
      return;
    }
    setInlineWarning(null);
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <>
      {atMax ? (
        <p className="flex h-12 w-full min-w-0 items-center rounded-lg border border-border bg-fill-subtle pl-3.5 pr-2.5 text-body-m-regular mobile:text-body-s-regular text-text-disabled">
          최대 {maxCount}개까지 추가할 수 있어요
        </p>
      ) : (
        <DestinationSearchInput
          value={draft}
          onChange={setDraft}
          onResolvedPlace={handleResolved}
          placeholder="여행지를 검색해 선택하세요"
          selectionOnly
          showLeadingIcon={false}
          appearance="field"
        />
      )}
      {values.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className={cn(chipVariants({ variant: "outline", size: "md" }), "max-w-full")}
            >
              <span className="min-w-0 truncate">{v}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`${v} 삭제`}
                className="-m-3.5 grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-primary"
              >
                <CloseIcon size={16} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {inlineWarning ? (
        <p className="text-body-s-regular mobile:text-body-xs-regular text-primary">{inlineWarning}</p>
      ) : null}
    </>
  );
}
