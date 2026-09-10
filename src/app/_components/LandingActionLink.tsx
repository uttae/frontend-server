import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function LandingActionLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent bg-primary px-5 py-2.5 font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
