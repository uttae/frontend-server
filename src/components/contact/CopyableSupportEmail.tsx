"use client";

import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";

import { SUPPORT_EMAIL } from "@/lib/contact";
import { cn } from "@/lib/utils";

type CopyableSupportEmailProps = {
  variant?: "inline" | "card";
  /** primary 등 진한 배경 위 */
  tone?: "default" | "onBrand";
  className?: string;
};

async function copySupportEmail() {
  try {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    toast.success("이메일을 복사했어요.");
  } catch {
    toast.error("복사하지 못했어요.");
  }
}

export function CopyableSupportEmail({
  variant = "inline",
  tone = "default",
  className,
}: CopyableSupportEmailProps) {
  const onBrand = tone === "onBrand";

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-gray-border bg-white p-4",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => void copySupportEmail()}
          className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-light-gray"
          aria-label={`${SUPPORT_EMAIL} 복사`}
        >
          <span className="min-w-0 flex-1 select-text truncate text-[17px] font-medium text-black">
            {SUPPORT_EMAIL}
          </span>
          <Copy
            className="h-4 w-4 shrink-0 text-dark-gray transition group-hover:text-black"
            strokeWidth={2}
            aria-hidden
          />
        </button>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-light-gray"
          aria-label="메일 앱으로 문의하기"
        >
          <Mail className="h-4 w-4 text-dark-gray" strokeWidth={2} aria-hidden />
        </a>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={() => void copySupportEmail()}
        className={cn(
          "group inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 transition",
          onBrand
            ? "text-white hover:bg-white/10"
            : "hover:bg-light-gray hover:text-black",
        )}
        aria-label={`${SUPPORT_EMAIL} 복사`}
      >
        <span className="select-text">{SUPPORT_EMAIL}</span>
        <Copy
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition",
            onBrand
              ? "text-white/70 group-hover:text-white"
              : "text-dark-gray/70 group-hover:text-black",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className={cn(
          "inline-flex items-center justify-center rounded-full p-0.5 transition",
          onBrand ? "text-white/80 hover:bg-white/10 hover:text-white" : "hover:bg-light-gray hover:text-black",
        )}
        aria-label="메일 앱으로 문의하기"
      >
        <Mail
          className={cn("h-3.5 w-3.5", onBrand ? "opacity-90" : "opacity-70")}
          strokeWidth={2}
          aria-hidden
        />
      </a>
    </span>
  );
}
