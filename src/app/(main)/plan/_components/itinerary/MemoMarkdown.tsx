"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/** Only a parsed task-list node can supply this offset; never match task labels. */
function taskMarker(source: string, offset: number | undefined) {
  if (offset === undefined) return null;
  const match = /^(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\](?=[\t \r\n]|$)/.exec(source.slice(offset));
  if (!match) return null;
  return { offset: offset + match[0].indexOf("[") + 1, checked: match[1].toLowerCase() === "x" };
}

export function MemoMarkdown({ memo, onToggle, disabled = false }: {
  memo: string;
  onToggle?: (next: string) => void;
  disabled?: boolean;
}) {
  return <div className="min-w-0 flex-1 break-words text-sm leading-relaxed text-gray-900 [&_p]:mb-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_blockquote]:border-l-2 [&_blockquote]:pl-2">
    <Markdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml
      urlTransform={(url) => /^(https?:\/\/|mailto:)/i.test(url) ? url : ""}
      components={{
        a({ href, children }) {
          return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary-strong underline underline-offset-2 hover:opacity-80" onClick={(e) => e.stopPropagation()}>{children}</a> : <>{children}</>;
        },
        img({ alt }) { return <span>{alt}</span>; },
        input() { return null; },
        li({ node, children, className }) {
          const marker = className?.includes("task-list-item") ? taskMarker(memo, node?.position?.start.offset) : null;
          return <li className={marker ? "list-none [&>p]:inline" : "list-disc"}>
            {marker && <input type="checkbox" aria-label={`체크리스트 ${node?.position?.start.line}행`} checked={marker.checked} disabled={disabled || !onToggle}
              className="mr-2 accent-primary" onClick={(e) => e.stopPropagation()}
              onChange={() => onToggle?.(memo.slice(0, marker.offset) + (marker.checked ? " " : "x") + memo.slice(marker.offset + 1))} />}
            {children}
          </li>;
        },
      }}
    >{memo}</Markdown>
  </div>;
}
