"use client";

import { useCurrentAgreements } from "@/hooks/useCurrentAgreements";
import { findAgreementByType } from "@/lib/agreements/paths";
import type { AgreementType } from "@/lib/agreements/types";

import { AgreementMarkdownContent } from "./AgreementMarkdownContent";

type Props = {
  agreementType: AgreementType;
};

export function PolicyDocumentView({ agreementType }: Props) {
  const { data, isPending, isError, error, refetch } = useCurrentAgreements();
  const agreement = data ? findAgreementByType(data.items, agreementType) : undefined;

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-border bg-white/95 px-6 py-10 text-center shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <p className="text-[17px] text-dark-gray">문서를 불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-primary/35 bg-primary/[0.06] px-6 py-8 text-center shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)]">
        <p className="text-[17px] font-medium text-primary">
          문서를 불러오지 못했습니다
        </p>
        <p className="mt-2 text-[17px] text-muted-brown">
          {error instanceof Error
            ? error.message
            : "잠시 후 다시 시도해 주세요."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 text-[17px] font-medium text-primary underline-offset-2 hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-border bg-white/95 px-6 py-10 text-center shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm">
        <p className="text-[17px] text-dark-gray">
          현재 게시된 문서를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-border bg-white/95 px-6 py-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-8 sm:py-10">
      <header className="border-b border-gray-border pb-6">
        <h2 className="text-[29px] font-bold text-neutral-900">{agreement.title}</h2>
        <p className="mt-2 text-[17px] text-dark-gray">버전 {agreement.version}</p>
      </header>

      <div className="pt-6">
        {agreement.contentFormat === "MARKDOWN" ? (
          <AgreementMarkdownContent
            content={agreement.content}
            variant="document"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[19px] leading-relaxed text-dark-gray">
            {agreement.content}
          </p>
        )}
      </div>
    </article>
  );
}
