"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
  const dialogRef = useRef<HTMLDivElement>(null);

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
    const focusable = () => [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    ];
    focusable()[0]?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function containFocus(event: FocusEvent) {
      if (!dialog.contains(event.target as Node)) focusable()[0]?.focus();
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
      if (
        trigger instanceof HTMLElement &&
        trigger !== document.body &&
        trigger.isConnected
      )
        trigger.focus();
      else
        document
          .querySelector<HTMLElement>("[data-cookie-settings-trigger]")
          ?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-lg overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 text-neutral-900 shadow-xl sm:p-8"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
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
      </div>
    </div>,
    document.body,
  );
}
