"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";

import {
  SettingsActionButton,
  SettingsActionButtonRow,
} from "@/components/settings/SettingsActionButton";
import {
  denyAnalyticsConsent,
  grantAnalyticsConsent,
} from "@/lib/analytics/consent-actions";
import {
  analyticsConsentStore,
  type AnalyticsConsentState,
  type AnalyticsConsentUpdateResult,
} from "@/lib/analytics/consent-store";
import { AGREEMENT_PUBLIC_PATH } from "@/lib/agreements/paths";

type AnalyticsConsentSettingsViewProps = {
  consent: AnalyticsConsentState;
  message: string;
  onDeny: () => void;
  onGrant: () => void;
};

const consentLabels: Record<AnalyticsConsentState, string> = {
  pending: "선택 전",
  granted: "분석 쿠키 허용",
  denied: "분석 쿠키 거부",
};

export function getAnalyticsConsentResultMessage(
  result: AnalyticsConsentUpdateResult,
): string {
  if (!result.persisted) {
    return "선택은 현재 탭에 적용했지만 브라우저에 저장하지 못했습니다. 새로고침 후 다시 선택해 주세요.";
  }

  return result.state === "granted"
    ? "분석 쿠키를 허용했습니다."
    : "분석 쿠키를 거부했습니다.";
}

export function AnalyticsConsentSettingsView({
  consent,
  message,
  onDeny,
  onGrant,
}: AnalyticsConsentSettingsViewProps) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-gray-border bg-white p-6 shadow-sm sm:p-8">
      <p className="text-[15px] font-medium text-dark-gray">현재 상태</p>
      <p className="mt-1 text-[22px] font-semibold text-neutral-900">
        {consentLabels[consent]}
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-dark-gray">
        허용하면 서비스 이용 흐름과 기능 사용 통계를 수집합니다. 거부하거나
        철회하면 Google Analytics 추적을 중단하고 브라우저의 분석 쿠키를
        삭제합니다.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-dark-gray">
        자세한 내용은{" "}
        <Link
          href={AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          개인정보 처리방침
        </Link>
        에서 확인할 수 있습니다.
      </p>
      <SettingsActionButtonRow className="mt-6">
        <SettingsActionButton
          variant="secondary"
          aria-pressed={consent === "denied"}
          onClick={onDeny}
        >
          거부
        </SettingsActionButton>
        <SettingsActionButton
          variant="primary"
          aria-pressed={consent === "granted"}
          onClick={onGrant}
        >
          허용
        </SettingsActionButton>
      </SettingsActionButtonRow>
      <p aria-live="polite" className="mt-4 min-h-6 text-[15px] text-dark-gray">
        {message}
      </p>
    </section>
  );
}

export function AnalyticsConsentSettings() {
  const consent = useSyncExternalStore(
    analyticsConsentStore.subscribe,
    analyticsConsentStore.getSnapshot,
    analyticsConsentStore.getServerSnapshot,
  );
  const [message, setMessage] = useState("");

  const showResult = useCallback((result: AnalyticsConsentUpdateResult) => {
    setMessage(getAnalyticsConsentResultMessage(result));
  }, []);

  return (
    <AnalyticsConsentSettingsView
      consent={consent}
      message={message}
      onGrant={() => showResult(grantAnalyticsConsent())}
      onDeny={() => showResult(denyAnalyticsConsent())}
    />
  );
}
