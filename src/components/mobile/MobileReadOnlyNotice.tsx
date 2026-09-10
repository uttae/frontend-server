"use client";

import { MessageSquareWarning, Monitor } from "lucide-react";
import { usePathname } from "next/navigation";

import { useMobileView } from "@/contexts/MobileViewContext";
import {
  isMobileReadOnlyNoticeRoute,
  mobileReadOnlyNoticeCopy,
} from "@/lib/mobile-view";

/** 모바일 사용자 피드백 채널 — 카카오톡 오픈채팅 */
const MOBILE_FEEDBACK_KAKAO_URL = "https://open.kakao.com/o/s4ucEBEi";

export function MobileReadOnlyNotice() {
  const pathname = usePathname();
  const { isMobileDevice } = useMobileView();

  if (!isMobileDevice || !isMobileReadOnlyNoticeRoute(pathname)) {
    return null;
  }

  return (
    <div
      role="status"
      className="shrink-0 border-b border-primary/15 bg-primary/[0.06] px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Monitor size={14} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-[14px] font-semibold text-primary">
            {mobileReadOnlyNoticeCopy.title}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-brown">
            {mobileReadOnlyNoticeCopy.description}
          </p>
        </div>
        <a
          href={MOBILE_FEEDBACK_KAKAO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="피드백 보내기 (새 창)"
          className="ml-1 inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-primary/25 bg-white px-2.5 py-1 text-[12px] font-semibold text-primary shadow-sm transition hover:bg-primary/5 active:bg-primary/10"
        >
          <MessageSquareWarning size={13} strokeWidth={2.2} aria-hidden />
          피드백
        </a>
      </div>
    </div>
  );
}
