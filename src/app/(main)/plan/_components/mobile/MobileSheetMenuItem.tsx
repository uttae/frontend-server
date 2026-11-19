import type { ReactNode } from "react";

import type { IconProps } from "@/assets/icons";
import { cn } from "@/lib/utils";

type MobileSheetMenuItemProps = Readonly<{
  icon: (props: IconProps) => ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}>;

export function MobileSheetMenuItem({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  trailing,
}: MobileSheetMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full shrink-0 items-center gap-3 text-left disabled:opacity-40"
    >
      <Icon size={20} className={danger ? "text-status-negative" : "text-icon"} />
      <span
        className={cn(
          "shrink-0 text-body-m-regular",
          danger ? "text-status-negative" : "text-text",
        )}
      >
        {label}
      </span>
      {trailing ? (
        <span className="ml-auto min-w-0 truncate pl-3 text-right">{trailing}</span>
      ) : null}
    </button>
  );
}
