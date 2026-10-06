"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CloseIcon, type IconProps } from "@/assets/icons";
import { useSheetDrag } from "./useSheetDrag";
import { BottomSheetDragHandle } from "./BottomSheetDragHandle";
import { cn } from "@/lib/utils";

type MobileBottomSheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  /** 제목 아래 보조 문구 — 예: 장소명 */
  subtitle?: string;
  /** `menu`: 항목 목록(제목 20px, 간격 8px) / `form`: 입력 폼(제목 18px, 간격 16px) */
  variant?: "menu" | "form";
  /** 저장 중 등 닫기를 막아야 할 때 */
  closeDisabled?: boolean;
  children: ReactNode;
}>;

/** 모바일 하단 시트 — 딤 배경, 핸들, 제목·닫기 줄로 구성된다 */
export function MobileBottomSheet(props: MobileBottomSheetProps) {
  if (!props.open || typeof document === "undefined") return null;
  return <MobileBottomSheetContent {...props} />;
}

function MobileBottomSheetContent({
  open,
  onClose,
  title,
  subtitle,
  variant = "menu",
  closeDisabled = false,
  children,
}: MobileBottomSheetProps) {
  const titleId = useId();
  const drag = useSheetDrag(onClose, closeDisabled, null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !closeDisabled) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div
        aria-hidden
        className="absolute inset-0 animate-in fade-in-0 bg-[rgba(15,23,36,0.35)] duration-200"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <dialog
        open
        style={drag.surfaceStyle}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative m-0 flex w-full max-h-[90dvh] max-w-none flex-col overflow-hidden rounded-t-[20px] border-0 bg-fill-elevate p-5 pb-[max(20px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200",
          variant === "menu" ? "gap-2" : "gap-4",
        )}
      >
        <BottomSheetDragHandle drag={drag} className={cn("touch-none select-none cursor-grab", variant === "menu" ? "space-y-2" : "space-y-4")}>
        <div aria-hidden className="flex shrink-0 justify-center">
          <span className="h-1 w-9 rounded-[2px] bg-border-subtle" />
        </div>
        <div className="flex shrink-0 items-center">
          <h2
            id={titleId}
            className={cn(
              "min-w-0 flex-1 truncate text-text",
              variant === "menu" ? "text-title-m" : "text-title-s",
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="닫기"
            className="-mr-2.5 flex size-11 shrink-0 items-center justify-center disabled:opacity-40"
          >
            <CloseIcon className="text-icon" />
          </button>
        </div>
        {subtitle ? (
          <p className="shrink-0 truncate text-caption-m-regular text-text-subtle">{subtitle}</p>
        ) : null}
        </BottomSheetDragHandle>
        <div className={cn("-m-1 flex min-h-0 flex-col overflow-y-auto overscroll-contain p-1", variant === "menu" ? "gap-2" : "gap-4")}>{children}</div>
      </dialog>
    </div>,
    document.body,
  );
}

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

/** 바텀시트 메뉴 한 줄 — 아이콘 20px + 라벨 */
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
