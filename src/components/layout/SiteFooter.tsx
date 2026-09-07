import Link from "next/link";

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

function FooterDot() {
  return (
    <span className="text-white/35" aria-hidden>
      ·
    </span>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn("relative z-10 bg-primary text-white", className)}
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center">
          <nav
            aria-label="정책 문서"
            className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm"
          >
            {POLICY_LINKS.map((item, index) => (
              <span
                key={item.href}
                className="inline-flex items-center gap-1.5"
              >
                {index > 0 ? <FooterDot /> : null}
                <Link href={item.href} className={linkClassName}>
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>

          <section
            aria-label="운영자 정보"
            className="mt-2.5 w-full border-t border-white/25 pt-2.5"
          >
            <dl className="mx-auto grid w-fit grid-cols-1 gap-y-1 text-sm sm:grid-cols-2 sm:gap-x-10 sm:gap-y-1">
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

          <p className="mt-2.5 text-center text-sm text-white/45">
            © {year} 우때. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
