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
        fixedWidth
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
