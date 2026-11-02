"use client";

import Link from "next/link";
import { CookieSettingsButton } from "./CookieSettingsProvider";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { AGREEMENT_PUBLIC_PATH } from "@/lib/agreements/paths";

type CookieConsentBannerProps = {
  onAccept: () => void;
  onReject: () => void;
};

export function CookieConsentBanner({
  onAccept,
  onReject,
}: CookieConsentBannerProps) {
  const reduceMotion = useReducedMotion();

  // z-40: 앱(isolate 묶음) 위, Base UI 대화상자·시트(z-50 포털) 아래다. 배너의 '쿠키 설정'으로 연 대화상자가 배너를 덮고 딤이 배너를 막는다
  return (
    <motion.div
      role="region"
      aria-label="쿠키 동의"
      initial={reduceMotion ? false : { y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.25 }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-screen-xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-body-m-regular mobile:text-body-s-regular leading-relaxed text-dark-gray">
          우때는 서비스 개선과 방문 통계 분석을 위해 Google Analytics 쿠키를
          사용합니다. 쿠키 사용에 동의하시겠습니까?{" "}
          <Link
            href={AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            개인정보 처리방침
          </Link>{" · "}
          <CookieSettingsButton className="cursor-pointer rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            쿠키 설정
          </CookieSettingsButton>
        </p>

        <div className="flex shrink-0 gap-2 sm:min-w-[220px]">
          <Button variant="outline" className="flex-1" onClick={onReject}>
            거부
          </Button>
          <Button tone="brand" className="flex-1" onClick={onAccept}>
            허용
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
