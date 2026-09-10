"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import { toInternalPolicyPath } from "@/lib/agreements/paths";
import { cn } from "@/lib/utils";

type MarkdownVariant = "compact" | "document";

const linkClassName =
  "text-primary-strong underline underline-offset-2 hover:opacity-90";

function createAgreementMarkdownComponents(
  variant: MarkdownVariant,
): Components {
  const isDocument = variant === "document";
  const bodyText = isDocument ? "text-[19px]" : "text-[17px]";
  const h1Class = isDocument
    ? "mb-4 text-[29px] font-bold text-neutral-900"
    : "mb-3 text-[22px] font-bold text-neutral-900";
  const h2Class = isDocument
    ? "mb-3 mt-6 text-2xl font-bold text-neutral-900"
    : "mb-2 mt-4 text-[19px] font-bold text-neutral-900";
  const h3Class = isDocument
    ? "mb-2 mt-4 text-[22px] font-semibold text-neutral-900"
    : "mb-2 mt-3 text-[17px] font-semibold text-neutral-900";

  return {
    h1({ children }) {
      return <h1 className={h1Class}>{children}</h1>;
    },
    h2({ children }) {
      return <h2 className={h2Class}>{children}</h2>;
    },
    h3({ children }) {
      return <h3 className={h3Class}>{children}</h3>;
    },
    p({ children }) {
      return (
        <p
          className={cn(
            "mb-2 leading-relaxed text-dark-gray last:mb-0",
            bodyText,
          )}
        >
          {children}
        </p>
      );
    },
    a({ href, children }) {
      const safeHref = href ?? "";
      const internalPath = toInternalPolicyPath(safeHref);

      if (internalPath) {
        return (
          <Link href={internalPath} className={linkClassName}>
            {children}
          </Link>
        );
      }

      return (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {children}
        </a>
      );
    },
    strong({ children }) {
      return (
        <strong className="font-semibold text-neutral-900">{children}</strong>
      );
    },
    em({ children }) {
      return <em className="italic">{children}</em>;
    },
    ul({ children }) {
      return (
        <ul
          className={cn(
            "my-2 list-disc space-y-1 pl-5 text-dark-gray",
            bodyText,
          )}
        >
          {children}
        </ul>
      );
    },
    ol({ children }) {
      return (
        <ol
          className={cn(
            "my-2 list-decimal space-y-1 pl-5 text-dark-gray",
            bodyText,
          )}
        >
          {children}
        </ol>
      );
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote
          className={cn(
            "my-2 border-l-2 border-gray-border pl-3 text-dark-gray",
            bodyText,
          )}
        >
          {children}
        </blockquote>
      );
    },
    hr() {
      return <hr className="my-4 border-gray-border" />;
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className={cn("w-full border-collapse", bodyText)}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-bubble-gray/80">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="border border-gray-border px-3 py-2 text-left font-semibold text-neutral-900">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border border-gray-border px-3 py-2 align-top text-dark-gray">
          {children}
        </td>
      );
    },
    code({ className, children }) {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code
            className={cn("block whitespace-pre-wrap break-words", className)}
          >
            {children}
          </code>
        );
      }
      return (
        <code className="rounded bg-bubble-gray px-1 py-0.5 font-mono text-[0.9em]">
          {children}
        </code>
      );
    },
    pre({ children }) {
      return (
        <pre
          className={cn(
            "my-2 overflow-x-auto rounded-lg bg-bubble-gray p-3 font-mono leading-relaxed",
            isDocument ? "text-[17px]" : "text-[14px]",
          )}
        >
          {children}
        </pre>
      );
    },
  };
}

const COMPACT_COMPONENTS = createAgreementMarkdownComponents("compact");
const DOCUMENT_COMPONENTS = createAgreementMarkdownComponents("document");

export function AgreementMarkdownContent({
  content,
  className,
  variant = "compact",
}: {
  content: string;
  className?: string;
  variant?: MarkdownVariant;
}) {
  if (!content) return null;

  return (
    <div className={cn("break-words", className)}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={
          variant === "document" ? DOCUMENT_COMPONENTS : COMPACT_COMPONENTS
        }
      >
        {content}
      </Markdown>
    </div>
  );
}
