"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/assets/icons";

/** Native modal focus containment, with a sheet surface on small screens. */
export function ExpenseDialog({
  title,
  onClose,
  children,
  footer,
  settlement = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  settlement?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const trigger = element?.ownerDocument.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger && trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[720px] overflow-hidden rounded-xl border-0 bg-white p-0 text-text shadow-xl backdrop:bg-black/40 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none mobile:mb-0 mobile:w-full mobile:rounded-b-none mobile:rounded-t-[20px] max-sm:rounded-t-[20px]"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div
          aria-hidden
          className="mx-auto mt-3 hidden h-1 w-9 shrink-0 rounded-full bg-border max-sm:block mobile:block"
        />
        <header className="flex shrink-0 items-center justify-between px-8 pt-8 pb-6 max-sm:px-5 max-sm:pt-4 max-sm:pb-2 mobile:px-5 mobile:pt-4 mobile:pb-2">
          <h2 id={titleId} className="text-[24px] leading-[34px] font-bold mobile:text-[20px] mobile:leading-7 max-sm:text-[20px] max-sm:leading-7">
            {title}
          </h2>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            onClick={onClose}
            className={`flex size-9 items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary ${footer ? "max-sm:hidden mobile:hidden" : ""}`}
          >
            <CloseIcon size={20} />
          </button>
        </header>
        <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-8 pb-6 [scrollbar-gutter:auto] max-sm:px-5 mobile:px-5">
          {children}
        </div>
        {footer && (
          <footer className={`shrink-0 px-8 pb-8 mobile:px-5 mobile:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:px-5 max-sm:pb-5 ${settlement ? "" : "border-t border-border-subtle pt-4"}`}>
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
