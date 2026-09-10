import type { Components } from "react-markdown";
import { chatAiBubbleEmphasisClass } from "@/components/chat/chat-typography";
import { cn } from "@/lib/utils";

export type ChatMarkdownVariant = "ai" | "mine" | "other";

export function getChatLinkClassName(variant: ChatMarkdownVariant): string {
  if (variant === "mine") {
    return "text-white underline underline-offset-2 hover:opacity-90";
  }
  return "text-primary-strong underline underline-offset-2 hover:opacity-90";
}

function strongClassName(variant: ChatMarkdownVariant): string {
  if (variant === "ai") return chatAiBubbleEmphasisClass;
  if (variant === "mine") return "font-semibold text-white";
  return "font-semibold";
}

export function createChatMarkdownComponents(
  variant: ChatMarkdownVariant,
): Components {
  const linkCls = getChatLinkClassName(variant);
  const strongCls = strongClassName(variant);

  return {
    p({ children }) {
      const preserveLayout = variant === "mine" || variant === "other";
      return (
        <p
          className={cn(
            "mb-1 last:mb-0 break-words",
            preserveLayout && "whitespace-pre-wrap",
          )}
        >
          {children}
        </p>
      );
    },
    br() {
      return <br />;
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          {children}
        </a>
      );
    },
    strong({ children }) {
      return <strong className={strongCls}>{children}</strong>;
    },
    em({ children }) {
      return <em className="italic">{children}</em>;
    },
    ul({ children }) {
      return (
        <ul className="my-1 list-disc space-y-0.5 break-words pl-4 last:mb-0">
          {children}
        </ul>
      );
    },
    ol({ children }) {
      return (
        <ol className="my-1 list-decimal space-y-0.5 break-words pl-4 last:mb-0">
          {children}
        </ol>
      );
    },
    li({ children }) {
      return <li className="break-words">{children}</li>;
    },
    code({ className, children }) {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code className={cn("block whitespace-pre-wrap break-words", className)}>
            {children}
          </code>
        );
      }
      return (
        <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] break-words">
          {children}
        </code>
      );
    },
    pre({ children }) {
      return (
        <pre className="my-1 overflow-x-auto rounded-md bg-black/10 p-2 font-mono text-xs leading-relaxed break-words last:mb-0">
          {children}
        </pre>
      );
    },
    blockquote({ children }) {
      return (
        <blockquote className="my-1 border-l-2 border-slate-300/80 pl-2 text-gray-700 last:mb-0">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="my-1 overflow-x-auto last:mb-0">
          <table className="w-full border-collapse text-xs">{children}</table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-black/5">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="border border-slate-300/80 px-2 py-1 text-left font-semibold">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="border border-slate-300/80 px-2 py-1 align-top">
          {children}
        </td>
      );
    },
    hr() {
      return <hr className="my-2 border-slate-300/80" />;
    },
  };
}
