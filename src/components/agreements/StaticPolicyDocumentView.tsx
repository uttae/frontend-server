import { AgreementMarkdownContent } from "@/components/agreements/AgreementMarkdownContent";

type StaticPolicyDocumentViewProps = {
  title: string;
  effectiveDate?: string;
  content: string;
};

export function StaticPolicyDocumentView({
  title,
  effectiveDate,
  content,
}: StaticPolicyDocumentViewProps) {
  return (
    <article className="mx-auto w-full max-w-3xl rounded-3xl border border-gray-border bg-white/95 px-6 py-8 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:px-8 sm:py-10">
      <header className="border-b border-gray-border pb-6">
        <h2 className="text-heading-m mobile:text-heading-s font-bold text-neutral-900">{title}</h2>
        {effectiveDate ? (
          <p className="mt-2 text-body-m-regular mobile:text-body-s-regular text-dark-gray">시행일: {effectiveDate}</p>
        ) : null}
      </header>

      <div className="pt-6">
        <AgreementMarkdownContent content={content} variant="document" />
      </div>
    </article>
  );
}
