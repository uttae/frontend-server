"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverContent } from "@/components/ui/popover";

import { DATE_PICKER_WIDTH } from "./DatePicker";

export type DatePickerPresentation = "anchored" | "popup";

export function DatePickerLayer({
  presentation,
  anchorRef,
  boundaryRef,
  label,
  onDismiss,
  onEscape,
  children,
}: Readonly<{
  presentation: DatePickerPresentation;
  anchorRef?: RefObject<HTMLElement | null>;
  boundaryRef?: RefObject<HTMLElement | null>;
  label: string;
  onDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const [opener] = useState(() => document.activeElement);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || dialog?.contains(active);
      if (focusWasInside && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [opener]);

  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (presentation !== "anchored" || !anchor) return;
    const fit = () => setZoom(anchor.clientWidth / DATE_PICKER_WIDTH);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [presentation, anchorRef]);

  if (presentation === "anchored") {
    return (
      <Popover
        open
        modal="trap-focus"
        onOpenChange={(open, details) => {
          if (open) return;
          if (details.reason === "escape-key" || details.reason === "close-press") {
            onEscape();
            return;
          }
          const next = details.reason === "focus-out" ? document.activeElement : details.event.target;
          if (next instanceof Node && boundaryRef?.current?.contains(next)) {
            details.cancel();
            return;
          }
          onDismiss();
        }}
      >
        <PopoverContent
          variant="bare"
          anchor={anchorRef}
          sideOffset={12}
          initialFocus={false}
          finalFocus={false}
          aria-label={label}
        >
          <div ref={dialogRef} style={{ zoom }}>
            {children}
          </div>
          <PopoverPrimitive.Close tabIndex={-1} className="sr-only">
            날짜 선택 닫기
          </PopoverPrimitive.Close>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === "escape-key") onEscape();
        else onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 min-h-dvh bg-black/40 supports-[-webkit-touch-callout:none]:absolute"
        />
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center-safe overflow-x-auto p-4">
          <DialogPrimitive.Popup
            ref={dialogRef}
            aria-label={label}
            aria-modal
            initialFocus={false}
            finalFocus={false}
            className="max-h-full w-full min-w-[300px] max-w-[353px] overflow-y-auto overscroll-contain rounded-[12px] outline-none"
          >
            {children}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
