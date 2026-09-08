import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import { AGREEMENT_PUBLIC_PATH } from "@/lib/agreements/paths";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { LANDING_CONTAINER_CLASS } from "@/lib/landing/landing-content";

/**
 * 랜딩 푸터 (데스크탑 기준 — 1차: 최소 CSS)
 *
 * footer (h 400 고정, bg fill/subtle)
 *  └─ 3줄, 세로 갭 40
 *      1줄: 로고 (BrandLogo combination)
 *      2줄: 정책 링크 — h 60, 항목 사이 40px (구분선)
 *      3줄: 운영자 정보 — 2그룹, 가로 갭 100
 */
export function FooterSection() {
  return (
    <footer className="h-[400px] w-full bg-fill">
      <div className={`${LANDING_CONTAINER_CLASS} flex flex-col gap-10 pt-20`}>
        {/* 1줄 — 로고 */}
        <BrandLogo variant="combination" size="S" />

        {/* 2줄 — 정책 링크 */}
        <nav
          aria-label="정책 문서"
          className="flex h-[60px] items-center divide-x divide-border text-body-m-regular text-text"
        >
          <Link
            href={AGREEMENT_PUBLIC_PATH.TERMS_OF_SERVICE}
            className="px-5 first:pl-0 hover:text-primary"
          >
            이용약관
          </Link>
          <Link href={AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY} className="px-5 hover:text-primary">
            개인정보 처리방침
          </Link>
          <Link href={AGREEMENT_PUBLIC_PATH.OPERATIONS_POLICY} className="px-5 hover:text-primary">
            운영정책
          </Link>
          <Link href={AGREEMENT_PUBLIC_PATH.COPYRIGHT_POLICY} className="px-5 hover:text-primary">
            저작권 정책
          </Link>
        </nav>

        {/* 3줄 — 운영자 정보 */}
        <div className="flex gap-[100px] text-body-s-regular">
          <dl className="flex flex-col gap-1">
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-text-subtle">서비스명</dt>
              <dd className="text-text">우때</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-text-subtle">이메일</dt>
              <dd className="text-text">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary">
                  {SUPPORT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
          <dl className="flex flex-col gap-1">
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-text-subtle">운영자</dt>
              <dd className="text-text">팀 우때 (Team Uttae)</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-16 shrink-0 text-text-subtle">호스팅</dt>
              <dd className="text-text">Amazon Web Services (AWS)</dd>
            </div>
          </dl>
        </div>
      </div>
    </footer>
  );
}
