"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

function restoreDialogFocus(trigger: Element | null) {
  if (trigger instanceof HTMLElement && trigger !== document.body && trigger.isConnected) {
    trigger.focus();
    return;
  }
  const fallback = document.querySelector<HTMLElement>("[data-cookie-settings-trigger]");
  if (fallback) {
    fallback.focus();
    return;
  }
  const main = document.querySelector<HTMLElement>("main, [role=main]");
  if (!main) return;
  const previousTabIndex = main.getAttribute("tabindex");
  main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
  if (previousTabIndex === null) main.removeAttribute("tabindex");
  else main.setAttribute("tabindex", previousTabIndex);
}

/** 기존 설정 모달의 표면·간격을 공유하는 키보드 접근 가능한 다이얼로그. */
export function SettingsDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = dialogRef.current!;
    const background = [...document.body.children].filter(
      (node) => node !== overlayRef.current,
    );
    const previousInert = background.map((node) => node.getAttribute("inert"));
    background.forEach((node) => node.setAttribute("inert", ""));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusScope = () => dialog.querySelector<HTMLElement>('[role="alertdialog"][aria-modal="true"]') ?? dialog;
    const focusable = () => [
      ...focusScope().querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], summary, input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    ];
    focusable()[0]?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && focusScope() === dialog) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function containFocus(event: FocusEvent) {
      if (!focusScope().contains(event.target as Node)) focusable()[0]?.focus();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = previousOverflow;
      background.forEach((node, index) => {
        const value = previousInert[index];
        if (value === null) node.removeAttribute("inert");
        else node.setAttribute("inert", value);
      });
      restoreDialogFocus(trigger);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${title} 배경 닫기`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <dialog
        open
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 border-0 max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-[640px] overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 text-neutral-900 shadow-xl [scrollbar-gutter:stable_both-edges] sm:px-8 sm:py-6"
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-[22px] font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-dark-gray hover:bg-bubble-gray focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        {children}
      </dialog>
    </div>,
    document.body,
  );
}
