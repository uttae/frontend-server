"use client";

import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import {
  createChatMarkdownComponents,
  getChatLinkClassName,
  type ChatMarkdownVariant,
} from "@/components/chat/chat-markdown-components";
import { prepareUserChatMarkdown } from "@/lib/chat/prepareUserChatMarkdown";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { cn } from "@/lib/utils";

export function ChatMarkdownContent({
  text,
  variant = "ai",
  className,
  preserveWhitespace = false,
}: {
  text: string;
  variant?: ChatMarkdownVariant;
  className?: string;
  preserveWhitespace?: boolean;
}) {
  if (!text) return null;

  if (preserveWhitespace) {
    const plain = prepareUserChatMarkdown(text);
    return (
      <div className={cn("whitespace-pre-wrap break-words", className)}>
        {renderTextWithLinks(plain, {
          linkClassName: getChatLinkClassName(variant),
        })}
      </div>
    );
  }

  return (
    <div className={cn("break-words", className)}>
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} components={createChatMarkdownComponents(variant)}>
        {text}
      </Markdown>
    </div>
  );
}
