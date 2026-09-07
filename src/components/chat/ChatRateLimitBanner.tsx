"use client";

import { AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type ChatRateLimitBannerProps = {
  message: string;
  isMinimized: boolean;
};

export function ChatRateLimitBanner({
  message,
  isMinimized,
}: ChatRateLimitBannerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
      className="overflow-hidden border-t border-primary/25 bg-primary/[0.06]"
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-primary",
          isMinimized ? "text-xs" : "text-[14px]",
        )}
      >
        <AlertCircle
          className={cn("shrink-0", isMinimized ? "h-3.5 w-3.5" : "h-4 w-4")}
          aria-hidden
        />
        <p className="min-w-0 flex-1 font-medium leading-snug">{message}</p>
      </div>
    </motion.div>
  );
}
