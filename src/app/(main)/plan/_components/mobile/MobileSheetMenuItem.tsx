import type { ReactNode } from "react";

import type { IconProps } from "@/assets/icons";
import { cn } from "@/lib/utils";

type MobileSheetMenuItemProps = Readonly<{
  icon: (props: IconProps) => ReactNode;
  label: string;
  onClick: () => void;
  /** 삭제 등 위험한 동작 */
  danger?: boolean;
  disabled?: boolean;
  /** 오른쪽에 붙는 보조 내용 — 예: 비용 합계 */
  trailing?: ReactNode;
}>;

/** 일정 관리 시트(Drawer)의 메뉴 한 줄 — 아이콘 20px + 라벨. 일차·장소 메뉴 시트가 함께 쓴다 */
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
