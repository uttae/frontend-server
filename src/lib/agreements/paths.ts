import type { AgreementItem, AgreementType } from "@/lib/agreements/types";

export const AGREEMENT_PUBLIC_PATH = {
  TERMS_OF_SERVICE: "/terms",
  PRIVACY_POLICY: "/privacy",
  OPERATIONS_POLICY: "/operations-policy",
  COPYRIGHT_POLICY: "/copyright-policy",
} as const;

const POLICY_PATH_SET = new Set<string>([
  AGREEMENT_PUBLIC_PATH.TERMS_OF_SERVICE,
  AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY,
  AGREEMENT_PUBLIC_PATH.OPERATIONS_POLICY,
  AGREEMENT_PUBLIC_PATH.COPYRIGHT_POLICY,
]);

export function agreementPathForType(type: AgreementType): string {
  return AGREEMENT_PUBLIC_PATH[type];
}

export function findAgreementByType(items: AgreementItem[], type: AgreementType): AgreementItem | undefined {
  return items.find((item) => item.type === type);
}

function normalizePolicyPathname(href: string): string | null {
  try {
    if (href.startsWith("/")) {
      return href.split("?")[0]?.split("#")[0] ?? null;
    }
    if (href.startsWith("http://") || href.startsWith("https://")) {
      const url = new URL(href);
      if (typeof window !== "undefined" && url.origin !== window.location.origin) {
        return null;
      }
      return url.pathname;
    }
  } catch {
    return null;
  }
  return null;
}

export function toInternalPolicyPath(href: string): string | null {
  const path = normalizePolicyPathname(href);
  if (!path || !POLICY_PATH_SET.has(path)) return null;
  return path;
}

export function isInternalPolicyHref(href: string): boolean {
  return toInternalPolicyPath(href) !== null;
}
