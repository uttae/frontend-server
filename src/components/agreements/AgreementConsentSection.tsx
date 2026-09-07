"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useCurrentAgreements } from "@/hooks/useCurrentAgreements";
import { agreementPathForType } from "@/lib/agreements/paths";

export type AgreementConsentState = {
  isLoading: boolean;
  isError: boolean;
  canProceed: boolean;
};

type Props = {
  onStateChange: (state: AgreementConsentState) => void;
};

export function AgreementConsentSection({ onStateChange }: Props) {
  const { data, isPending, isError, error, refetch } = useCurrentAgreements();
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(() => new Set());
  const itemIds = useMemo(
    () => items.map((item) => `${item.type}:${item.version}`),
    [items],
  );
  const allAccepted =
    itemIds.length > 0 && itemIds.every((id) => acceptedIds.has(id));
  const canProceed = !isPending && !isError && allAccepted;

  useEffect(() => {
    onStateChange({
      isLoading: isPending,
      isError,
      canProceed,
    });
  }, [isPending, isError, canProceed, onStateChange]);

  const toggleAll = (accepted: boolean) => {
    setAcceptedIds(accepted ? new Set(itemIds) : new Set());
  };

  const toggleItem = (id: string, accepted: boolean) => {
    setAcceptedIds((current) => {
      const next = new Set(current);
      if (accepted) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (isPending) {
    return (
      <div className="w-full rounded-xl border border-gray-border bg-bubble-gray/40 px-4 py-3 text-left">
        <p className="text-[17px] text-dark-gray">약관을 불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full rounded-xl border border-primary/35 bg-primary/[0.06] px-4 py-3 text-left">
        <p className="text-[17px] font-medium text-primary">
          약관을 불러오지 못했습니다
        </p>
        <p className="mt-1 text-[17px] text-muted-brown">
          {error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-[17px] font-medium text-primary underline-offset-2 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-border bg-bubble-gray/30 px-4 py-3 text-left">
        <p className="text-[17px] text-dark-gray">
          현재 동의할 약관 정보를 불러올 수 없습니다. 잠시 후 다시 시도해
          주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-border bg-bubble-gray/25 px-4 py-4 text-left">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-primary"
          checked={allAccepted}
          onChange={(event) => toggleAll(event.target.checked)}
        />
        <span className="text-[17px] font-semibold leading-snug text-neutral-900">
          필수 약관 전체 동의
        </span>
      </label>

      <ul className="mt-3 space-y-1 border-t border-gray-border/80 pt-3">
        {items.map((item) => {
          const id = `${item.type}:${item.version}`;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/80"
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded accent-primary"
                  checked={acceptedIds.has(id)}
                  onChange={(event) => toggleItem(id, event.target.checked)}
                />
                <span className="inline-flex h-[18px] shrink-0 items-center rounded px-1 text-xs font-semibold leading-none text-primary">
                  필수
                </span>
                <span className="truncate text-[17px] text-neutral-800">
                  {item.title}
                </span>
              </label>
              <Link
                href={agreementPathForType(item.type)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex shrink-0 items-center gap-0.5 text-[14px] font-medium text-dark-gray hover:text-neutral-900"
              >
                자세히 보기
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
