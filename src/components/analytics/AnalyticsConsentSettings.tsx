"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";

import { SettingsActionButton } from "@/components/settings/SettingsActionButton";
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
  const categoryId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const allowed = draft === "granted";

  return (
    <section>
      <p className="text-[15px] leading-relaxed text-dark-gray">
        서비스 개선을 위한 분석 쿠키 사용 여부를 선택해 주세요.
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 border-y border-gray-border py-4">
        <div className="min-w-0">
          <h3 id={categoryId} className="text-base font-semibold">
            분석 쿠키
          </h3>
          <p
            id={descriptionId}
            className="mt-1 text-sm leading-relaxed text-dark-gray"
          >
            Google Analytics로 방문과 기능 사용 통계를 분석합니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-labelledby={categoryId}
          aria-describedby={`${descriptionId} ${hintId}`}
          onClick={allowed ? onDeny : onGrant}
          className="flex min-h-11 shrink-0 cursor-pointer flex-col items-center gap-1.5 sm:flex-row sm:gap-3 rounded-lg px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors motion-reduce:transition-none ${allowed ? "bg-primary" : "bg-neutral-400"}`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${allowed ? "translate-x-5" : "translate-x-0"}`}
            />
          </span>
          <span
            aria-hidden="true"
            className="text-xs font-medium text-dark-gray"
          >
            {allowed ? "허용" : "허용 안 함"}
          </span>
        </button>
      </div>
      <p id={hintId} className="mt-3 text-xs leading-relaxed text-dark-gray">
        {consent === "pending" ? "아직 저장된 선택이 없습니다. " : ""}
        저장을 누르면 {allowed ? "허용이" : "거부가"} 적용됩니다.
      </p>
      <details className="mt-4 text-sm leading-relaxed text-dark-gray">
        <summary className="w-fit cursor-pointer rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          쿠키 사용 안내
        </summary>
        <p className="mt-2">
          허용하면 서비스 이용 흐름과 기능 사용 통계를 수집합니다. 거부하거나
          철회하면 Google Analytics 추적을 중단하고 브라우저의 분석 쿠키를
          삭제합니다.
        </p>
      </details>
      <div className="mt-4 flex items-center justify-between gap-4">
        <Link
          href={AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY}
          className="rounded-sm text-sm font-medium text-dark-gray underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          개인정보 처리방침
        </Link>
        <SettingsActionButton
          variant="primary"
          flex={false}
          className="min-h-11 min-w-24 px-6 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={onSave}
        >
          저장
        </SettingsActionButton>
      </div>
      <p
        aria-live="polite"
        className="text-sm leading-relaxed text-dark-gray not-empty:mt-3"
      >
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
