"use client";

import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useStompConnectionStore } from "@/stores/stomp-connection-store";

type StompConnectionBannerProps = {
  onRetry: () => void;
};

export function StompConnectionBanner({ onRetry }: StompConnectionBannerProps) {
  const connectionIssue = useStompConnectionStore((s) => s.connectionIssue);
  const reduceMotion = useReducedMotion();

  if (!connectionIssue) {
    return null;
  }

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="fixed top-0 right-0 left-0 z-50 overflow-hidden border-b border-primary/25 bg-primary/[0.06] shadow-sm"
    >
      <div className="mx-auto flex max-w-screen-xl items-center gap-2 px-4 py-2.5 text-primary">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-[14px] font-medium leading-snug sm:text-[17px]">
          {connectionIssue}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "shrink-0 rounded-md border border-primary/30 bg-white/80 px-2.5 py-1",
            "text-[14px] font-semibold text-primary transition-colors",
            "hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          다시 시도
        </button>
      </div>
    </motion.div>
  );
}
