"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** room-settings `RoomTripEditForm` 하단 액션 버튼과 동일 */
export const settingsActionButtonVariantClass = {
  secondary:
    "rounded-full border border-gray-border bg-transparent py-2.5 text-label-l-emphasis mobile:text-label-m-emphasis font-semibold text-dark-gray transition hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-40",
  primary:
    "rounded-full border border-transparent bg-primary py-2.5 text-label-l-emphasis mobile:text-label-m-emphasis font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
} as const;

/** Figma Alert Dialog 버튼 — Secondary와 Primary(Neutral·Brand Solid·Critical) */
export const alertDialogButtonClass = {
  secondary:
    "h-12 cursor-pointer rounded-lg bg-fill px-3.5 text-label-l-emphasis text-text transition-colors enabled:hover:bg-fill-strong disabled:cursor-not-allowed disabled:text-text-disabled",
  neutral:
    "h-12 cursor-pointer rounded-lg bg-[var(--gray-800)] px-3.5 text-label-l-emphasis text-text-inverse transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
  brand:
    "h-12 cursor-pointer rounded-lg bg-primary px-3.5 text-label-l-emphasis text-text-inverse transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
  critical:
    "h-12 cursor-pointer rounded-lg bg-status-negative px-3.5 text-label-l-emphasis text-text-inverse transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
} as const;

export type SettingsActionButtonVariant = keyof typeof settingsActionButtonVariantClass;

type SettingsActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: SettingsActionButtonVariant;
  /** 기본 `flex-1` — 모달 단일 버튼 등은 `false` + `className="w-full"` */
  flex?: boolean;
};

export function SettingsActionButton({
  variant,
  flex = true,
  className,
  type = "button",
  ...props
}: SettingsActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer",
        flex ? "flex-1" : null,
        settingsActionButtonVariantClass[variant],
        className,
      )}
      {...props}
    />
  );
}

export function SettingsActionButtonRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex gap-2 pt-2", className)}>{children}</div>;
}
