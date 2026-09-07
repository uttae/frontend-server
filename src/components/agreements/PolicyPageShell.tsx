import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function PolicyPageShell({ title, children, className }: Props) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col bg-gradient-to-b from-bubble-gray/80 via-white to-white",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(1,131,255,0.08),_transparent_55%)]"
        aria-hidden
      />

      <header className="relative z-10 border-b border-gray-border/60 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <BrandLogo variant="combination" size="S" alt="로고" />
          </Link>
          <h1 className="text-[17px] font-semibold text-neutral-900 sm:text-[19px]">{title}</h1>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 py-10 sm:px-6">{children}</main>

      <SiteFooter className="relative z-10" />
    </div>
  );
}
