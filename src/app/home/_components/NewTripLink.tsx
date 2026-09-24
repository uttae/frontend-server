import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NewTripLink({ className }: { className?: string }) {
  return (
    <Link
      href="/home/new"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-3.5 py-[13px] text-label-l-emphasis text-text-inverse transition-colors hover:bg-primary-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        className,
      )}
    >
      <Image src="/rooms/figma/plus-mobile.svg" width={20} height={20} alt="" className="size-5" />
      <span className="px-1.5">새 여행 시작</span>
    </Link>
  );
}
