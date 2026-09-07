import Link from "next/link";

import { LandingActionLink } from "@/app/_components/LandingActionLink";
import { BrandLogo } from "@/components/BrandLogo";
import { LANDING_CONTAINER_CLASS } from "@/lib/landing/landing-content";

const navItems = [
  { href: "/#features", label: "기능" },
  { href: "/#how-it-works", label: "사용 방법" },
  { href: "/#team", label: "팀" },
] as const;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-border/60 bg-white/90 font-sans backdrop-blur-md">
      <div className={`${LANDING_CONTAINER_CLASS} flex items-center justify-between gap-4 py-3`}>
        <Link
          href="/"
          aria-label="우때 홈"
          className="flex items-center gap-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <BrandLogo
            variant="combination"
            size="S"
            alt="우때 로고"
          />
          
        </Link>
        <nav aria-label="랜딩 페이지" className="ml-auto hidden items-center gap-7 landing-sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-dark-gray transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LandingActionLink href="/login" className="px-5 py-2.5 text-sm">
          로그인
        </LandingActionLink>
      </div>
    </header>
  );
}
