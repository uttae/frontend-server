import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NewTripLink({ className }: { className?: string }) {
  return (
    <Link
      href="/home/new"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[12px] bg-primary p-4 text-label-xl-emphasis mobile:text-label-l-emphasis font-bold leading-[22px] tracking-[-0.02em] text-text-inverse transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        className,
      )}
    >
      <Image src="/rooms/figma/plus.svg" width={24} height={24} alt="" className="size-6 mobile:hidden" />
      <Image src="/rooms/figma/plus-mobile.svg" width={20} height={20} alt="" className="hidden size-5 mobile:block" />
      <span className="px-1.5">새 여행 시작</span>
    </Link>
  );
}
