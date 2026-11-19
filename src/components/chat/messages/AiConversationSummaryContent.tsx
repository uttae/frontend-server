"use client";

import { ChatMarkdownContent } from "@/components/chat/ChatMarkdownContent";
import {
  chatAiBubbleListTextClass,
  chatAiBubbleOverviewBodyClass,
  chatAiBubbleSectionLabelClass,
  chatAiBubbleBlockTitleClass,
} from "@/components/chat/chat-typography";
import type { AiConversationSummaryPayload } from "@/types/chat";
import { cn } from "@/lib/utils";

export function AiConversationSummaryContent({
  summary,
  isMinimized,
}: {
  summary: AiConversationSummaryPayload;
  isMinimized: boolean;
}) {
  const titleCls = chatAiBubbleBlockTitleClass(isMinimized);
  const bodyCls = chatAiBubbleOverviewBodyClass(isMinimized);
  const sectionTitleCls = chatAiBubbleSectionLabelClass(isMinimized);
  const listCls = chatAiBubbleListTextClass(isMinimized);

  return (
    <div className="mt-2 space-y-3 border-t border-slate-300/80 pt-2">
      <div className={titleCls}>
        <ChatMarkdownContent text={summary.title} variant="ai" />
      </div>
      <div className={bodyCls}>
        <ChatMarkdownContent text={summary.overview} variant="ai" />
      </div>

      {summary.sections?.map((sec) => {
        if (!sec.items?.length) return null;
        return (
          <div key={`${sec.type}-${sec.title}`} className="space-y-1">
            <div className={sectionTitleCls}>{sec.title}</div>
            <ul className={cn("list-disc space-y-0.5 pl-4", listCls)}>
              {sec.items.map((item, idx) => (
                <li key={idx}>
                  <ChatMarkdownContent text={item} variant="ai" />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
