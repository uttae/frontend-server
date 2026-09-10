"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { DestinationSearchInput } from "@/components/search/DestinationSearchInput";

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  maxCount: number;
  maxLength: number;
};

export function DestinationChipsField({
  values,
  onChange,
  readOnly = false,
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

  if (readOnly) {
    if (!values.length) {
      return <p className="text-[17px] text-dark-gray">—</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center rounded-full bg-bubble-gray/60 px-3 py-1 text-[15px] text-dark-gray"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1.5 pl-3 pr-1.5 text-[15px] text-primary"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`${v} 삭제`}
                className="rounded-full p-0.5 transition hover:bg-primary/20"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {atMax ? (
        <p className="text-[14px] text-light-gray">
          최대 {maxCount}개까지 추가할 수 있어요
        </p>
      ) : (
        <DestinationSearchInput
          value={draft}
          onChange={setDraft}
          onResolvedPlace={handleResolved}
          selectionOnly
          leadingIconType="search"
        />
      )}
      {inlineWarning ? (
        <p className="text-[14px] text-primary">{inlineWarning}</p>
      ) : null}
    </div>
  );
}
