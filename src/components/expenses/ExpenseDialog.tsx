"use client";
import { useExpenseSheetDrag } from "./useExpenseSheetDrag";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/assets/icons";

/** Native modal focus containment, with a sheet surface on small screens. */
export function ExpenseDialog({
  title,
  onClose,
  children,
  footer,
  settlement = false,
  description,
}: Readonly<{
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  settlement?: boolean;
  description?: ReactNode;
}>) {
  const sheetDrag = useExpenseSheetDrag(onClose);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = ref.current;
    const trigger = element?.ownerDocument.activeElement;
    element?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      if (trigger && trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  useEffect(() => {
    const element = ref.current;
    const dismissBackdrop = (event: MouseEvent) => {
      if (event.target === element) onClose();
    };
    element?.addEventListener("click", dismissBackdrop);
    return () => element?.removeEventListener("click", dismissBackdrop);
  }, [onClose]);
  return (
    <dialog
      ref={ref}
      style={sheetDrag.surfaceStyle}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`fixed inset-0 m-auto ${settlement ? "mobile:h-[calc(100dvh-92px)] mobile:max-h-[calc(100dvh-92px)] max-sm:h-[calc(100dvh-92px)] max-sm:max-h-[calc(100dvh-92px)]" : ""} max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-[720px] overflow-hidden rounded-xl border-0 bg-white p-0 text-text shadow-xl backdrop:bg-black/40 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none mobile:mb-0 mobile:w-full mobile:rounded-b-none mobile:rounded-t-[20px] max-sm:rounded-t-[20px]`}
    >
      <div className="flex max-h-[calc(100dvh-3rem)] flex-col mobile:h-full mobile:max-h-full max-sm:h-full max-sm:max-h-full">
        <div {...sheetDrag.handleProps} className={sheetDrag.handleClassName}>
        <div
          aria-hidden
          className="mx-auto hidden h-1 w-9 shrink-0 rounded-full bg-border max-sm:block mobile:block"
        />
        <header className="flex shrink-0 items-center justify-between px-8 pt-8 pb-6 max-sm:px-5 max-sm:pt-3 max-sm:pb-3 mobile:px-5 mobile:pt-3 mobile:pb-3">
          <div>
          <h2 ref={heading} id={titleId} tabIndex={-1} className="focus:outline-none text-[24px] leading-[34px] font-bold mobile:text-[20px] mobile:leading-6 max-sm:text-[20px] max-sm:leading-6">
            {title}
          </h2>
          {description && <p className="mt-1 hidden text-[12px] leading-5 text-text-subtle mobile:block max-sm:block">{description}</p>}
          </div>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            onClick={onClose}
            className={`cursor-pointer flex size-6 items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary ${footer ? "max-sm:hidden mobile:hidden" : ""}`}
          >
            <CloseIcon size={24} />
          </button>
        </header>
        </div>
        <div className="flex min-h-0 flex-col overflow-y-auto mobile:flex-1 max-sm:flex-1 overscroll-contain px-8 pb-6 [scrollbar-gutter:auto] max-sm:px-5 mobile:px-5">
          {children}
        </div>
        {footer && (
          <footer className={`shrink-0 px-8 pb-8 mobile:px-5 mobile:pt-3 max-sm:pt-3 mobile:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:px-5 max-sm:pb-5 ${settlement ? "" : "border-t border-border-subtle pt-4"}`}>
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
