"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/assets/icons";

/** Native modal focus containment, with a sheet surface on small screens. */
export function ExpenseDialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-[680px] overflow-hidden rounded-xl border-0 bg-white p-0 text-text shadow-xl backdrop:bg-black/40 max-sm:mb-0 max-sm:w-full max-sm:rounded-b-none mobile:mb-0 mobile:w-full mobile:rounded-b-none"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div
          aria-hidden
          className="mx-auto mt-3 hidden h-1 w-9 shrink-0 rounded-full bg-border max-sm:block mobile:block"
        />
        <header className="flex shrink-0 items-center justify-between px-6 py-4 max-sm:px-5 mobile:px-5">
          <h2 id={titleId} className="text-title-m font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md text-text-subtle hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary"
          >
            <CloseIcon size={20} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-5 max-sm:px-5 mobile:px-5">
          {children}
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-border-subtle px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
