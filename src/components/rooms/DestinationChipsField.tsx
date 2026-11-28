"use client";

import { useState } from "react";

import { DestinationSearchInput } from "@/components/search/DestinationSearchInput";
import { Chip, ChipRemove } from "@/components/ui/chip";
import { FieldBox, FieldBoxLabel, FieldBoxRow } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  maxCount: number;
  maxLength: number;
};

export function DestinationChipsField({ values, onChange, maxCount, maxLength }: Readonly<Props>) {
  const [draft, setDraft] = useState("");
  const [warning, setWarning] = useState<{ message: string; values: string[] } | null>(null);
  const inlineWarning = warning?.values === values ? warning.message : null;
  const atMax = values.length >= maxCount;

  function handleResolved(place: { description: string; placeId: string } | null) {
    if (!place) return;
    const next = place.description.trim().slice(0, maxLength);
    if (!next) return;
    setDraft("");
    if (values.includes(next)) {
      setWarning({ message: "이미 추가한 여행지예요", values });
      return;
    }
    if (values.length >= maxCount) {
      setWarning({ message: `여행지는 최대 ${maxCount}개까지 추가할 수 있어요`, values });
      return;
    }
    onChange([...values, next]);
  }

  return (
    <>
      {atMax ? (
        <FieldBox>
          <FieldBoxLabel>목적지</FieldBoxLabel>
          <FieldBoxRow>
            <span className="truncate px-1 text-text-disabled">최대 {maxCount}개까지 추가할 수 있어요</span>
          </FieldBoxRow>
        </FieldBox>
      ) : (
        <DestinationSearchInput
          value={draft}
          onChange={setDraft}
          onResolvedPlace={handleResolved}
          placeholder="여행지를 검색해 선택하세요"
          selectionOnly
          appearance="emphasis"
          label="목적지"
        />
      )}
      {inlineWarning ? (
        <p className="text-body-s-regular mobile:text-body-xs-regular text-primary">{inlineWarning}</p>
      ) : null}
    </>
  );
}

export function DestinationChipList({
  values,
  onChange,
  className,
}: Readonly<{ values: string[]; onChange: (next: string[]) => void; className?: string }>) {
  if (values.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {values.map((v, i) => (
        <Chip key={`${v}-${i}`} variant="outline" size="md" selected className="max-w-full">
          <span className="min-w-0 truncate">{v}</span>
          <ChipRemove aria-label={`${v} 삭제`} onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </Chip>
      ))}
    </div>
  );
}
