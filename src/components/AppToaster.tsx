"use client";

import { Toaster } from "sonner";

import { readIsMobileDevice } from "@/lib/mobile-view";

/** --toast-bottom-inset은 모바일 하단 탭바가 있을 때만 globals.css에서 정의된다 */
const MOBILE_BOTTOM_OFFSET = "calc(var(--toast-bottom-inset, 0px) + 16px)";
export function AppToaster() {
  if (!readIsMobileDevice()) {
    return <Toaster position="top-right" richColors />;
  }

  return (
    <Toaster
      position="bottom-right"
      offset={{ bottom: MOBILE_BOTTOM_OFFSET }}
      mobileOffset={{ bottom: MOBILE_BOTTOM_OFFSET }}
      richColors
    />
  );
}
