"use client";

import { ClipboardList } from "lucide-react";

import { useSessionPromptVisible } from "@/hooks/useSessionPromptVisible";
import { FEEDBACK_FORM_URL } from "@/lib/contact";

import { FEEDBACK_FORM_CLICKED_KEY } from "./sidebarFeedbackForm";
import { SidebarPingBadge } from "./SidebarPingBadge";
import { sidebarNavButtonClassName } from "./sidebarNavButton";

export function SidebarFeedbackFormButton() {
  const { visible: showBadge, dismiss } = useSessionPromptVisible(
    FEEDBACK_FORM_CLICKED_KEY,
  );

  return (
    <div className="relative">
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className={sidebarNavButtonClassName()}
        aria-label="피드백 설문"
      >
        <ClipboardList
          className="h-6 w-6 text-dark-gray"
          strokeWidth={2}
          aria-hidden
        />
      </a>

      {showBadge ? <SidebarPingBadge /> : null}
    </div>
  );
}
