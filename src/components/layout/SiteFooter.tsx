import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsProvider";
import { BrandLogo } from "@/components/BrandLogo";

import { AGREEMENT_PUBLIC_PATH } from "@/lib/agreements/paths";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { cn } from "@/lib/utils";

const POLICY_LINKS = [
  { href: AGREEMENT_PUBLIC_PATH.TERMS_OF_SERVICE, label: "이용약관" },
  { href: AGREEMENT_PUBLIC_PATH.PRIVACY_POLICY, label: "개인정보 처리방침" },
  { href: AGREEMENT_PUBLIC_PATH.OPERATIONS_POLICY, label: "운영정책" },
  { href: AGREEMENT_PUBLIC_PATH.COPYRIGHT_POLICY, label: "저작권 정책" },
] as const;

const linkClassName = "text-white/85 transition-colors hover:text-white";

/**
 * Figma 푸터 메뉴는 좁은 화면에서 3개 + 2개 두 줄로 끊긴다.
 * flex 컨테이너 안의 전폭 아이템이 줄바꿈을 강제하고, 넓은 화면에서는 숨겨 한 줄로 둔다.
 */
const MENU_WRAP_INDEX = 3;

function MenuLineBreak() {
  return <li aria-hidden className="w-full sm:hidden" />;
}

function FooterDot({ className }: { className?: string }) {
  return (
    <span className={cn("text-white/35", className)} aria-hidden>
      ·
    </span>
  );
}

export function SiteFooter({ className, logo, variant = "default" }: {
  className?: string;
  logo?: ReactNode;
  variant?: "default" | "room-list";
}) {
  const year = new Date().getFullYear();

  if (variant === "room-list") {
    return (
      <footer className={cn("bg-fill text-text", className)}>
        {/* Figma 모바일 푸터(135:620)는 사방 32px 패딩에 블록 간격 20px */}
        <div className="mx-auto flex max-w-[1272px] flex-col gap-10 px-6 pb-20 pt-[60px] mobile:gap-5 mobile:p-8">
          <Link href="/" aria-label="우때 홈" className="w-fit [&_img]:h-[22px] [&_img]:w-[73px]">
            <BrandLogo variant="combination" size="S" />
          </Link>
          <nav aria-label="정책 문서">
            <ul className="flex min-h-[60px] flex-wrap items-center gap-x-5 gap-y-0 text-label-l-regular sm:gap-y-3 mobile:min-h-0 mobile:gap-x-[14px] mobile:text-label-s-emphasis">
              {POLICY_LINKS.map((item, index) => (
                <Fragment key={item.href}>
                  {index === MENU_WRAP_INDEX && <MenuLineBreak />}
                  <li className="inline-flex items-center gap-5 mobile:gap-[14px]">
                    {index > 0 && (
                      <span
                        aria-hidden
                        className={cn("h-9 w-px bg-border mobile:h-6", index === MENU_WRAP_INDEX && "hidden sm:block")}
                      />
                    )}
                    <Link href={item.href} className="flex h-12 items-center hover:underline">{item.label}</Link>
                  </li>
                </Fragment>
              ))}
              <li className="inline-flex items-center gap-5 mobile:gap-[14px]">
                <span aria-hidden className="h-9 w-px bg-border mobile:h-6" />
                <CookieSettingsButton className="h-12 cursor-pointer hover:underline">
                  쿠키 설정
                </CookieSettingsButton>
              </li>
            </ul>
          </nav>
          {/* 데스크톱은 열 우선 2열(서비스명·이메일 / 운영자·호스팅), 모바일은 한 열로 Figma 순서를 그대로 따른다 */}
          <dl className="grid w-fit grid-cols-1 gap-x-[100px] gap-y-1.5 text-label-l-regular mobile:gap-y-3 mobile:text-label-s-regular md:grid-flow-col md:grid-rows-2">
            <div className="flex gap-[25px]"><dt className="w-[68px] shrink-0 text-text-subtle">서비스명</dt><dd>우때</dd></div>
            <div className="flex gap-[25px]"><dt className="w-[68px] shrink-0 text-text-subtle">이메일</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">{SUPPORT_EMAIL}</a></dd></div>
            <div className="flex gap-[25px]"><dt className="w-[68px] shrink-0 text-text-subtle">운영자</dt><dd>팀 우때 (Team Uttae)</dd></div>
            <div className="flex gap-[25px]"><dt className="w-[68px] shrink-0 text-text-subtle">호스팅</dt><dd>Amazon Web Services (AWS)</dd></div>
          </dl>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={cn("relative z-10 bg-primary text-white", className)}
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center">
          {logo ? <Link href="/" aria-label="우때 홈">{logo}</Link> : null}
          <nav aria-label="정책 문서">
            <ul className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-body-s-regular mobile:text-body-xs-regular">
              {POLICY_LINKS.map((item, index) => (
                <Fragment key={item.href}>
                  {index === MENU_WRAP_INDEX && <MenuLineBreak />}
                  <li className="inline-flex items-center gap-1.5">
                    {index > 0 ? (
                      <FooterDot className={index === MENU_WRAP_INDEX ? "hidden sm:inline" : undefined} />
                    ) : null}
                    <Link href={item.href} className={linkClassName}>
                      {item.label}
                    </Link>
                  </li>
                </Fragment>
              ))}
              <li className="inline-flex items-center gap-1.5">
                <FooterDot />
                <CookieSettingsButton className={`${linkClassName} cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>
                  쿠키 설정
                </CookieSettingsButton>
              </li>
            </ul>
          </nav>

          <section
            aria-label="운영자 정보"
            className="mt-2.5 w-full border-t border-white/25 pt-2.5"
          >
            <dl className="mx-auto grid w-fit grid-cols-1 gap-y-1 text-body-s-regular mobile:text-body-xs-regular sm:grid-cols-2 sm:gap-x-10 sm:gap-y-1">
              <div className="flex min-w-0 gap-2">
                <dt className="w-[3.25rem] shrink-0 text-white/50">서비스명</dt>
                <dd className="min-w-0 text-white/85">우때</dd>
              </div>
              <div className="flex min-w-0 gap-2">
                <dt className="w-[3.25rem] shrink-0 text-white/50">운영자</dt>
                <dd className="min-w-0 text-white/85">팀 우때 (Team Uttae)</dd>
              </div>
              <div className="flex min-w-0 gap-2">
                <dt className="w-[3.25rem] shrink-0 text-white/50">이메일</dt>
                <dd className="min-w-0">
                  <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClassName}>
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="flex min-w-0 gap-2">
                <dt className="w-[3.25rem] shrink-0 text-white/50">호스팅</dt>
                <dd className="min-w-0 text-white/85">
                  Amazon Web Services (AWS)
                </dd>
              </div>
            </dl>
          </section>

          <p className="mt-2.5 text-center text-body-s-regular mobile:text-body-xs-regular text-white/45">
            © {year} 우때. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
