"use client";

import type { ReactNode } from "react";

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useMobileView } from "@/contexts/MobileViewContext";

/**
 * 가계부 읽기 전용 대화상자(정산 요약). PC는 Dialog(720), 모바일 기기는 아래 시트(ResponsiveDialog).
 * 조건부로 마운트해 열고, 닫기 요청(Esc·딤·X·스와이프)은 onClose로 받는다.
 */
export function ExpenseDialog({
  title,
  onClose,
  children,
  footer,
  description,
}: Readonly<{
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 시트에서만 제목 아래 보조 줄로 보인다(지금 화면과 같음) */
  description?: ReactNode;
}>) {
  const { isMobileDevice } = useMobileView();
  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent
        size="xl"
        // 정산 요약 시트는 상단 내비 아래까지 채운다(Figma Bottom Sheet Height=BelowNav)
        drawerSize="belowNav"
        closeLabel={`${title} 닫기`}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description && isMobileDevice ? (
            <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>
          ) : null}
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>{children}</ResponsiveDialogBody>
        {footer ? <ResponsiveDialogFooter>{footer}</ResponsiveDialogFooter> : null}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
