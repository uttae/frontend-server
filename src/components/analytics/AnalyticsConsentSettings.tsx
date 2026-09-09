"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

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
  draft: AnalyticsConsentState;
  onSave: () => void;
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
  draft,
  onSave,
}: AnalyticsConsentSettingsViewProps) {
  return (
    <section>
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
          className="aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-pressed={draft === "denied"}
          onClick={onDeny}
        >
          거부
        </SettingsActionButton>
        <SettingsActionButton
          variant="primary"
          className="aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-pressed={draft === "granted"}
          onClick={onGrant}
        >
          허용
        </SettingsActionButton>
      </SettingsActionButtonRow>
      <p className="mt-4 text-[15px] font-medium text-dark-gray">
        저장할 선택: {consentLabels[draft]}
      </p>
      <p className="mt-2 text-sm text-dark-gray">
        선택 저장을 누르면 변경 사항이 적용됩니다.
      </p>
      <SettingsActionButton
        variant="primary"
        className="mt-4 w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        disabled={draft === "pending"}
        onClick={onSave}
      >
        선택 저장
      </SettingsActionButton>
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
  const [draft, setDraft] = useState(analyticsConsentStore.getSnapshot);
  const [message, setMessage] = useState("");

  function save() {
    if (draft === "pending") return;
    const result =
      draft === "granted" ? grantAnalyticsConsent() : denyAnalyticsConsent();
    setMessage(getAnalyticsConsentResultMessage(result));
  }
  function select(value: AnalyticsConsentState) {
    setDraft(value);
    setMessage("");
  }

  return (
    <AnalyticsConsentSettingsView
      consent={consent}
      message={message}
      draft={draft}
      onGrant={() => select("granted")}
      onDeny={() => select("denied")}
      onSave={save}
    />
  );
}
