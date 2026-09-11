"use client";

import { useSessionPromptVisible } from "@/hooks/useSessionPromptVisible";
import { FEEDBACK_FORM_URL } from "@/lib/contact";
import { sidebarWireframeIcons } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

import { FEEDBACK_FORM_CLICKED_KEY } from "./sidebarFeedbackForm";
import { SidebarPingBadge } from "./SidebarPingBadge";
import { sidebarNavButtonClassName } from "./sidebarNavButton";
import { SidebarIcon } from "./SidebarIcon";

export function SidebarFeedbackFormButton() {
  const { visible: showBadge, dismiss } = useSessionPromptVisible(
    FEEDBACK_FORM_CLICKED_KEY,
  );

  return (
    <div className="relative w-full">
      <a
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className={cn(sidebarNavButtonClassName(), "font-normal tracking-normal text-text")}
        aria-label="피드백 설문"
      >
        <SidebarIcon src={sidebarWireframeIcons.feedback} />
        <span>피드백</span>
      </a>

      {showBadge ? <SidebarPingBadge /> : null}
    </div>
  );
}
